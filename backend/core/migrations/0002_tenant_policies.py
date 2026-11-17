from django.db import migrations


OWNER = "NULLIF(current_setting('thesiswatch.user_id', true), '')::bigint"
POLICIES = {
    "core_watchlist": f"owner_id = {OWNER}",
    "core_watchlistentry": (
        f"EXISTS (SELECT 1 FROM core_watchlist AS w WHERE w.id = watchlist_id AND w.owner_id = {OWNER})"
    ),
    "core_securitynote": f"owner_id = {OWNER}",
}


def apply_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table, expression in POLICIES.items():
        schema_editor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        schema_editor.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        schema_editor.execute(
            f"CREATE POLICY owner_access ON {table} USING ({expression}) WITH CHECK ({expression})"
        )


def remove_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in POLICIES:
        schema_editor.execute(f"DROP POLICY owner_access ON {table}")
        schema_editor.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        schema_editor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]
    operations = [migrations.RunPython(apply_policies, remove_policies)]
