from importlib import import_module

from django.db import migrations


previous = import_module("research.migrations.0002_row_security")


def update_policies(schema_editor, rename):
    if schema_editor.connection.vendor != "postgresql":
        return
    expression = previous.OWNER_MATCH
    if rename:
        expression = expression.replace("thesiswatch.user_id", "datatalk.user_id")
    schema_editor.execute(
        f"ALTER POLICY research_run_owner ON research_researchrun "
        f"USING ({expression}) WITH CHECK ({expression})"
    )
    schema_editor.execute(
        f"ALTER POLICY research_thesis_read ON research_thesis USING ({expression})"
    )
    schema_editor.execute(
        f"ALTER POLICY research_thesis_publish ON research_thesis WITH CHECK ({expression})"
    )


def use_datatalk(apps, schema_editor):
    update_policies(schema_editor, rename=True)


def restore_previous(apps, schema_editor):
    update_policies(schema_editor, rename=False)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_datatalk_tenant_policies"),
        ("research", "0002_row_security"),
    ]
    operations = [migrations.RunPython(use_datatalk, restore_previous)]
