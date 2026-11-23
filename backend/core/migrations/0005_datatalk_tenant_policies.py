from importlib import import_module

from django.db import migrations


previous = import_module("core.migrations.0002_tenant_policies")


def update_policies(schema_editor, rename):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table, expression in previous.POLICIES.items():
        if rename:
            expression = expression.replace("thesiswatch.user_id", "datatalk.user_id")
        schema_editor.execute(
            f"ALTER POLICY owner_access ON {table} USING ({expression}) WITH CHECK ({expression})"
        )


def use_datatalk(apps, schema_editor):
    update_policies(schema_editor, rename=True)


def restore_previous(apps, schema_editor):
    update_policies(schema_editor, rename=False)


class Migration(migrations.Migration):
    dependencies = [("core", "0004_authwindow")]
    operations = [migrations.RunPython(use_datatalk, restore_previous)]
