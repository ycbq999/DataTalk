from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class Security(models.Model):
    exchange = models.CharField(max_length=12)
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=160)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["exchange", "symbol"], name="unique_listed_symbol"),
        ]
        ordering = ["symbol", "exchange"]

    def __str__(self):
        return f"{self.symbol} · {self.exchange}"


class Watchlist(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=80)

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("name"), "owner", name="unique_watchlist_name_per_owner"),
        ]
        ordering = ["id"]


class WatchlistEntry(models.Model):
    watchlist = models.ForeignKey(Watchlist, related_name="entries", on_delete=models.CASCADE)
    security = models.ForeignKey(Security, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["watchlist", "security"], name="unique_security_per_watchlist"
            ),
        ]
        ordering = ["id"]


class SecurityNote(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    security = models.ForeignKey(Security, on_delete=models.PROTECT)
    text = models.TextField(max_length=2000, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "security"], name="unique_security_note"),
        ]
