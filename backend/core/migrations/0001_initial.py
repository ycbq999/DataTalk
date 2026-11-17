import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Security",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("exchange", models.CharField(max_length=12)),
                ("symbol", models.CharField(max_length=20)),
                ("name", models.CharField(max_length=160)),
            ],
            options={
                "ordering": ["symbol", "exchange"],
                "constraints": [
                    models.UniqueConstraint(fields=("exchange", "symbol"), name="unique_listed_symbol"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Watchlist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["id"],
                "constraints": [
                    models.UniqueConstraint(
                        django.db.models.functions.text.Lower("name"), models.F("owner"),
                        name="unique_watchlist_name_per_owner",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="WatchlistEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("security", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.security")),
                ("watchlist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="core.watchlist")),
            ],
            options={
                "ordering": ["id"],
                "constraints": [
                    models.UniqueConstraint(fields=("watchlist", "security"), name="unique_security_per_watchlist"),
                ],
            },
        ),
        migrations.CreateModel(
            name="SecurityNote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(blank=True, max_length=2000)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ("security", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.security")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("owner", "security"), name="unique_security_note"),
                ],
            },
        ),
    ]
