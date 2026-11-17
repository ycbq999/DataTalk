import logging

from billiard.exceptions import SoftTimeLimitExceeded
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .provider import ResearchError, generate_thesis
from .service import claim_research, publish_thesis, record_error

logger = logging.getLogger(__name__)


@shared_task(acks_late=True, reject_on_worker_lost=True, soft_time_limit=105, time_limit=120)
def run_research(owner_id, run_id):
    attempt = claim_research(owner_id, run_id)
    if attempt is None:
        return
    try:
        result = generate_thesis(
            attempt.security,
            api_key=settings.OPENAI_API_KEY,
            model=attempt.model,
            as_of=timezone.now().date(),
        )
    except ResearchError as exc:
        logger.warning("Research provider error for run %s: %s", run_id, exc)
        record_error(owner_id, attempt, str(exc), retryable=exc.retryable)
    except SoftTimeLimitExceeded:
        record_error(owner_id, attempt, "Research timed out. Please try again.", retryable=True)
    else:
        publish_thesis(owner_id, attempt, result)
