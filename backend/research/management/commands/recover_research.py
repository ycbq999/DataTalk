from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from research.service import dispatch, is_enabled, recoverable_runs


class Command(BaseCommand):
    help = "Re-enqueue research runs interrupted by a worker or queue outage."

    def add_arguments(self, parser):
        parser.add_argument("--after-owner-id", type=int, default=0)
        parser.add_argument("--owner-limit", type=int, default=1_000)
        parser.add_argument("--run-limit", type=int, default=100)

    def handle(self, *, after_owner_id, owner_limit, run_limit, **options):
        if not is_enabled():
            raise CommandError("Research must be enabled to recover jobs.")
        if after_owner_id < 0 or not 1 <= owner_limit <= 10_000 or not 1 <= run_limit <= 1_000:
            raise CommandError("Specify valid owner and run limits.")

        dispatched = 0
        attempted = 0
        owners = list(
            get_user_model()
            .objects.filter(is_active=True, pk__gt=after_owner_id)
            .order_by("pk")
            .values_list("pk", flat=True)[:owner_limit + 1]
        )
        last_scanned_owner = after_owner_id
        for owner_id in owners[:owner_limit]:
            remaining = run_limit - attempted
            for run_id in recoverable_runs(owner_id, limit=remaining):
                attempted += 1
                if dispatch(owner_id, run_id):
                    dispatched += 1
            if attempted >= run_limit:
                break
            last_scanned_owner = owner_id
        self.stdout.write(f"Re-enqueued {dispatched} research runs.")
        if attempted >= run_limit or len(owners) > owner_limit:
            self.stdout.write(f"Continue with --after-owner-id={last_scanned_owner}.")
