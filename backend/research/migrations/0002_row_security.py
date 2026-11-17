from django.db import migrations


OWNER_MATCH = "owner_id = NULLIF(current_setting('thesiswatch.user_id', true), '')::bigint"


def enable_row_security(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("ALTER TABLE research_researchrun ENABLE ROW LEVEL SECURITY")
    schema_editor.execute("ALTER TABLE research_researchrun FORCE ROW LEVEL SECURITY")
    schema_editor.execute(
        f"CREATE POLICY research_run_owner ON research_researchrun "
        f"USING ({OWNER_MATCH}) WITH CHECK ({OWNER_MATCH})"
    )
    schema_editor.execute("ALTER TABLE research_thesis ENABLE ROW LEVEL SECURITY")
    schema_editor.execute("ALTER TABLE research_thesis FORCE ROW LEVEL SECURITY")
    schema_editor.execute(
        f"CREATE POLICY research_thesis_read ON research_thesis FOR SELECT USING ({OWNER_MATCH})"
    )
    schema_editor.execute(
        f"CREATE POLICY research_thesis_publish ON research_thesis FOR INSERT WITH CHECK ({OWNER_MATCH})"
    )


def disable_row_security(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("DROP POLICY research_run_owner ON research_researchrun")
    schema_editor.execute("ALTER TABLE research_researchrun DISABLE ROW LEVEL SECURITY")
    schema_editor.execute("ALTER TABLE research_researchrun NO FORCE ROW LEVEL SECURITY")
    schema_editor.execute("DROP POLICY research_thesis_read ON research_thesis")
    schema_editor.execute("DROP POLICY research_thesis_publish ON research_thesis")
    schema_editor.execute("ALTER TABLE research_thesis DISABLE ROW LEVEL SECURITY")
    schema_editor.execute("ALTER TABLE research_thesis NO FORCE ROW LEVEL SECURITY")


class Migration(migrations.Migration):
    dependencies = [("research", "0001_initial")]
    operations = [migrations.RunPython(enable_row_security, disable_row_security)]
