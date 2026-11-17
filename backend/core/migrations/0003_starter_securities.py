from django.db import migrations


STARTER_SECURITIES = (
    ("XNAS", "AAPL", "Apple"),
    ("XNAS", "AMD", "Advanced Micro Devices"),
    ("XNAS", "AMZN", "Amazon"),
    ("XNAS", "AVGO", "Broadcom"),
    ("XNAS", "GOOGL", "Alphabet, Class A"),
    ("XNYS", "HPE", "Hewlett Packard Enterprise"),
    ("XNAS", "INTC", "Intel"),
    ("XNAS", "META", "Meta Platforms"),
    ("XNAS", "MSFT", "Microsoft"),
    ("XNAS", "NVDA", "NVIDIA"),
    ("XNAS", "QCOM", "Qualcomm"),
    ("XNYS", "SPOT", "Spotify"),
)


def seed(apps, schema_editor):
    security = apps.get_model("core", "Security")
    security.objects.using(schema_editor.connection.alias).bulk_create(
        [security(exchange=exchange, symbol=symbol, name=name) for exchange, symbol, name in STARTER_SECURITIES],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0002_tenant_policies")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
