from datetime import timedelta
from math import ceil

from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from core.models import AuthWindow


LIMITS = {"sign-in": (30, 300), "sign-up": (12, 600)}


def auth_retry_after(request, action):
    # Use the transport peer. Forwarding headers are not a trusted client identity.
    client = request.META.get("REMOTE_ADDR", "")
    key = salted_hmac(f"datatalk.{action}", client, algorithm="sha256").hexdigest()
    maximum, seconds = LIMITS[action]
    with transaction.atomic():
        now = timezone.now()
        window, _ = AuthWindow.objects.select_for_update().get_or_create(
            key=key, defaults={"expires_at": now + timedelta(seconds=seconds)}
        )
        if window.expires_at <= now:
            window.expires_at = now + timedelta(seconds=seconds)
            window.attempts = 0
        if window.attempts >= maximum:
            return max(1, ceil((window.expires_at - now).total_seconds()))
        window.attempts += 1
        window.save(update_fields=["expires_at", "attempts"])
    return None
