import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="DailyProviderUsage",
            fields=[
                ("day", models.DateField(primary_key=True, serialize=False)),
                ("calls", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name="ResearchRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("succeeded", "Succeeded"), ("failed", "Failed")], default="queued", max_length=9)),
                ("model", models.CharField(max_length=120)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("lease_token", models.UUIDField(null=True)),
                ("lease_expires_at", models.DateTimeField(null=True)),
                ("last_dispatched_at", models.DateTimeField(null=True)),
                ("error", models.CharField(blank=True, max_length=250)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(null=True)),
                ("finished_at", models.DateTimeField(null=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ("security", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.security")),
            ],
            options={
                "indexes": [models.Index(fields=["owner", "created_at"], name="research_run_owner_date")],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("owner", "security"),
                        condition=models.Q(status__in=["queued", "running"]),
                        name="research_one_active_run",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="Thesis",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.PositiveIntegerField()),
                ("schema_version", models.PositiveSmallIntegerField()),
                ("prompt_version", models.CharField(max_length=30)),
                ("provider_response_id", models.CharField(max_length=120)),
                ("model", models.CharField(max_length=120)),
                ("report", models.JSONField()),
                ("sources", models.JSONField()),
                ("provider_usage", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ("run", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, to="research.researchrun")),
                ("security", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.security")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("owner", "security", "version"),
                        name="research_unique_thesis_version",
                    )
                ]
            },
        ),
    ]
