import logging
from datetime import UTC, datetime, time, timedelta
from functools import partial
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Max, Q
from django.utils import timezone
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from core.tenancy import owner_scope

from .models import DailyProviderUsage, ResearchRun, Thesis
from .provider import PROMPT_VERSION, SCHEMA_VERSION

logger = logging.getLogger(__name__)
ACTIVE = (ResearchRun.Status.QUEUED, ResearchRun.Status.RUNNING)
DISPATCH_INTERVAL = timedelta(minutes=3)
LEASE_DURATION = timedelta(seconds=150)


class ResearchLimit(Exception):
    pass


class ResearchAccessDenied(Exception):
    pass


def is_enabled():
    return settings.RESEARCH_ENABLED and bool(settings.CELERY_BROKER_URL)


def _owned_runs(owner_id):
    return ResearchRun.objects.filter(owner_id=owner_id)


def _account_is_active(owner_id):
    user = (
        get_user_model()
        .objects.select_for_update()
        .filter(pk=owner_id, is_active=True)
        .values("pk")
        .first()
    )
    return user is not None


def request_research(owner_id, security):
    with owner_scope(owner_id):
        # Serialize submissions for one account so limits still apply to concurrent requests.
        if not _account_is_active(owner_id):
            raise ResearchAccessDenied
        runs = _owned_runs(owner_id)
        run = runs.filter(security=security, status__in=ACTIVE).first()
        if run is None:
            day = timezone.now().date()
            start = datetime.combine(day, time.min, tzinfo=UTC)
            if runs.filter(created_at__gte=start).count() >= settings.RESEARCH_DAILY_LIMIT:
                raise ResearchLimit("You have reached the daily research limit. Try again tomorrow.")
            if DailyProviderUsage.objects.filter(day=day, calls__gte=settings.RESEARCH_GLOBAL_DAILY_LIMIT).exists():
                raise ResearchLimit("The research service has reached today's usage limit.")
            run = ResearchRun.objects.create(owner_id=owner_id, security=security, model=settings.OPENAI_MODEL)
        transaction.on_commit(partial(dispatch, owner_id, run.pk))
        return run


def recoverable_runs(owner_id, *, limit=100):
    now = timezone.now()
    with owner_scope(owner_id):
        return list(
            _owned_runs(owner_id)
            .filter(
                Q(status=ResearchRun.Status.QUEUED)
                | Q(status=ResearchRun.Status.RUNNING, lease_expires_at__lte=now)
            )
            .filter(Q(last_dispatched_at__isnull=True) | Q(last_dispatched_at__lte=now - DISPATCH_INTERVAL))
            .order_by("pk")
            .values_list("pk", flat=True)[:limit]
        )


def _reserve_dispatch(owner_id, run_id):
    now = timezone.now()
    with owner_scope(owner_id):
        run = _owned_runs(owner_id).select_for_update().filter(pk=run_id, status__in=ACTIVE).first()
        if run is None:
            return None
        if run.status == ResearchRun.Status.RUNNING and run.lease_expires_at > now:
            return None
        if run.last_dispatched_at is not None and now - run.last_dispatched_at < DISPATCH_INTERVAL:
            return None
        run.last_dispatched_at = now
        run.save(update_fields=["last_dispatched_at"])
    return now


def dispatch(owner_id, run_id, *, countdown=0):
    from .tasks import run_research

    stamp = _reserve_dispatch(owner_id, run_id)
    if stamp is None:
        return False
    try:
        run_research.apply_async(args=(owner_id, run_id), countdown=countdown or None)
    except (OperationalError, RedisError, OSError):
        logger.warning("Could not dispatch research run %s", run_id)
        with owner_scope(owner_id):
            # If the broker accepted the task before the error, don't cancel a claimed new lease.
            run = (
                _owned_runs(owner_id)
                .select_for_update()
                .filter(pk=run_id, status__in=ACTIVE, last_dispatched_at=stamp)
                .first()
            )
            if run and (run.lease_expires_at is None or run.lease_expires_at <= stamp):
                _record_failure(run, "The research queue is unavailable. Please try again later.")
        return False
    return True


def _record_failure(run, error):
    run.status = ResearchRun.Status.FAILED
    run.error = error
    run.finished_at = timezone.now()
    run.lease_token = None
    run.lease_expires_at = None
    run.save(update_fields=["status", "error", "finished_at", "lease_token", "lease_expires_at"])


def claim_research(owner_id, run_id):
    now = timezone.now()
    with owner_scope(owner_id):
        account_is_active = _account_is_active(owner_id)
        run = (
            _owned_runs(owner_id)
            .select_related("security")
            .select_for_update(of=("self",))
            .filter(pk=run_id, status__in=ACTIVE)
            .first()
        )
        if run is None:
            return None
        if not account_is_active:
            _record_failure(run, "The research account is no longer active.")
            return None
        if run.status == ResearchRun.Status.RUNNING and run.lease_expires_at > now:
            return None
        if not is_enabled() or not settings.OPENAI_API_KEY:
            _record_failure(run, "Research is temporarily unavailable.")
            return None
        if run.attempts >= settings.RESEARCH_MAX_ATTEMPTS:
            _record_failure(run, "Research stopped after repeated interruptions. Please try again.")
            return None
        usage, _ = DailyProviderUsage.objects.get_or_create(day=now.date())
        reserved = DailyProviderUsage.objects.filter(
            pk=usage.pk, calls__lt=settings.RESEARCH_GLOBAL_DAILY_LIMIT
        ).update(calls=F("calls") + 1)
        if not reserved:
            _record_failure(run, "The research service has reached today's usage limit.")
            return None

        run.status = ResearchRun.Status.RUNNING
        run.attempts += 1
        run.started_at = run.started_at or now
        run.error = ""
        run.lease_token = uuid4()
        run.lease_expires_at = now + LEASE_DURATION
        run.save(update_fields=["status", "attempts", "started_at", "error", "lease_token", "lease_expires_at"])
        return run


def _active_lease(owner_id, run):
    return (
        _owned_runs(owner_id)
        .select_for_update()
        .filter(pk=run.pk, status=ResearchRun.Status.RUNNING, lease_token=run.lease_token)
        .first()
    )


def record_error(owner_id, attempt, error, *, retryable=False):
    with owner_scope(owner_id):
        account_is_active = _account_is_active(owner_id)
        run = _active_lease(owner_id, attempt)
        if run is None:
            return
        if not account_is_active:
            _record_failure(run, "The research account is no longer active.")
        elif retryable and run.attempts < settings.RESEARCH_MAX_ATTEMPTS:
            run.status = ResearchRun.Status.QUEUED
            run.lease_token = None
            run.lease_expires_at = None
            run.last_dispatched_at = None
            run.save(update_fields=["status", "lease_token", "lease_expires_at", "last_dispatched_at"])
            transaction.on_commit(partial(dispatch, owner_id, run.pk, countdown=10 * run.attempts))
        else:
            _record_failure(run, error)


def publish_thesis(owner_id, attempt, result):
    with owner_scope(owner_id):
        account_is_active = _account_is_active(owner_id)
        run = _active_lease(owner_id, attempt)
        if run is None:
            return
        if not account_is_active:
            _record_failure(run, "The research account is no longer active.")
            return
        current_version = Thesis.objects.filter(owner_id=owner_id, security=run.security).aggregate(
            latest=Max("version")
        )["latest"] or 0
        Thesis.objects.create(
            owner_id=owner_id,
            security=run.security,
            run=run,
            version=current_version + 1,
            schema_version=SCHEMA_VERSION,
            prompt_version=PROMPT_VERSION,
            provider_response_id=result.response_id,
            model=result.model,
            report=result.report,
            sources=result.sources,
            provider_usage=result.usage,
        )
        run.status = ResearchRun.Status.SUCCEEDED
        run.finished_at = timezone.now()
        run.lease_token = None
        run.lease_expires_at = None
        run.save(update_fields=["status", "finished_at", "lease_token", "lease_expires_at"])
