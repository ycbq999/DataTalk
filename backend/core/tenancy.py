from contextlib import contextmanager

from django.db import connection, transaction


@contextmanager
def owner_scope(owner_id):
    """Bind a trusted authenticated user to the current database transaction."""
    with transaction.atomic():
        if connection.vendor != "postgresql":
            yield
            return

        with connection.cursor() as cursor:
            cursor.execute("SELECT current_setting('thesiswatch.user_id', true)")
            previous = cursor.fetchone()[0]
            cursor.execute("SELECT set_config('thesiswatch.user_id', %s, true)", [str(owner_id)])

        # If the caller raises, the savepoint rollback restores the local setting.
        yield
        if not connection.needs_rollback:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT set_config('thesiswatch.user_id', %s, true)", [previous or ""]
                )
