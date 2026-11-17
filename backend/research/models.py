from django.conf import settings
from django.db import models


class ResearchRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    security = models.ForeignKey("core.Security", on_delete=models.PROTECT)
    status = models.CharField(max_length=9, choices=Status, default=Status.QUEUED)
    model = models.CharField(max_length=120)
    attempts = models.PositiveSmallIntegerField(default=0)
    lease_token = models.UUIDField(null=True)
    lease_expires_at = models.DateTimeField(null=True)
    last_dispatched_at = models.DateTimeField(null=True)
    error = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "created_at"], name="research_run_owner_date")]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "security"],
                condition=models.Q(status__in=["queued", "running"]),
                name="research_one_active_run",
            ),
        ]


class Thesis(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    security = models.ForeignKey("core.Security", on_delete=models.PROTECT)
    run = models.OneToOneField(ResearchRun, on_delete=models.PROTECT)
    version = models.PositiveIntegerField()
    schema_version = models.PositiveSmallIntegerField()
    prompt_version = models.CharField(max_length=30)
    provider_response_id = models.CharField(max_length=120)
    model = models.CharField(max_length=120)
    report = models.JSONField()
    sources = models.JSONField()
    provider_usage = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "security", "version"],
                name="research_unique_thesis_version",
            )
        ]


class DailyProviderUsage(models.Model):
    """Aggregate quota ledger. Contains no user data or provider credentials."""

    day = models.DateField(primary_key=True)
    calls = models.PositiveIntegerField(default=0)
