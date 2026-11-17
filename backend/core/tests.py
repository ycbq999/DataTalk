from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError, connection, transaction
from django.test import Client, TestCase

from core.models import Security, SecurityNote, Watchlist, WatchlistEntry
from core.tenancy import owner_scope


API = "/api/v1"


class DashboardApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = get_user_model().objects.create_user("alice", password="local-test-password")
        cls.bob = get_user_model().objects.create_user("bob")
        cls.security = Security.objects.get(symbol="MSFT")

    def test_public_stock_catalog_exposes_no_private_workspace_data(self):
        response = self.client.get(f"{API}/market/securities/", {"q": "microsoft", "exchange": "XNAS"})
        self.assertEqual(response.json(), [{
            "id": self.security.pk, "symbol": "MSFT", "exchange": "XNAS", "name": "Microsoft",
        }])
        self.assertEqual(self.client.get(
            f"{API}/market/securities/", {"q": "MSFT", "exchange": "XNYS"}
        ).json(), [])
        self.assertRedirects(self.client.get("/workspace/"), "/sign-in/?next=/workspace/",
                             fetch_redirect_response=False)
        for path in ("watchlists/", f"securities/{self.security.pk}/note/", f"securities/{self.security.pk}/research/"):
            self.assertEqual(self.client.get(f"{API}/{path}").status_code, 403)

    def test_registration_requires_csrf_and_signs_in_a_valid_new_account(self):
        client = Client(enforce_csrf_checks=True)
        url = f"{API}/register/"
        details = {"username": "new-investor", "password": "a-strong-passphrase!!"}
        self.assertEqual(client.post(url, details, content_type="application/json").status_code, 403)
        client.get(f"{API}/session/")
        headers = {"X-CSRFToken": client.cookies["csrftoken"].value}
        weak = client.post(
            url, {**details, "password": "1234"}, content_type="application/json", headers=headers,
        )
        self.assertEqual(weak.status_code, 400)
        self.assertIn("password", weak.json())
        result = client.post(url, details, content_type="application/json", headers=headers)
        user = get_user_model().objects.get(username=details["username"])
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json(), {"user": {"id": user.pk, "username": details["username"]}})
        self.assertFalse(user.is_staff)
        self.assertTrue(user.check_password(details["password"]))
        self.assertEqual(client.get(f"{API}/watchlists/").json(), [])

        duplicate = self.client.post(
            url, {**details, "username": "NEW-INVESTOR"}, content_type="application/json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("username", duplicate.json())

    def test_signup_throttle_is_shared_across_sessions(self):
        url = f"{API}/register/"
        body = {"username": "a", "password": "1234"}
        with patch.dict("core.auth_limits.LIMITS", {"sign-up": (1, 60)}):
            self.assertEqual(self.client.post(url, body, content_type="application/json").status_code, 400)
            limited = Client().post(url, body, content_type="application/json")
        self.assertEqual(limited.status_code, 429)
        self.assertGreater(int(limited.headers["Retry-After"]), 0)

    def test_login_logout_and_mutations_enforce_csrf(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.get(f"{API}/health/").json(), {"status": "ok"})
        self.assertEqual(client.get(f"{API}/session/").json(), {"user": None})
        credentials = {"username": "alice", "password": "local-test-password"}
        login_url = f"{API}/session/"
        self.assertEqual(client.post(login_url, credentials, content_type="application/json").status_code, 403)
        response = client.post(
            login_url, credentials, content_type="application/json",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )
        self.assertEqual(response.json(), {"user": {"id": self.alice.pk, "username": "alice"}})
        self.assertEqual(
            client.post(f"{API}/watchlists/", {"name": "Core"}, content_type="application/json").status_code, 403
        )
        self.assertEqual(client.delete(login_url).status_code, 403)
        self.assertEqual(client.delete(
            login_url, headers={"X-CSRFToken": client.cookies["csrftoken"].value}
        ).status_code, 204)
        self.assertEqual(client.get(f"{API}/watchlists/").status_code, 403)

    def test_watchlist_workflow_preserves_private_note_after_removal(self):
        self.client.force_login(self.alice)
        security = self.client.get(f"{API}/securities/", {"q": "msft"}).json()[0]
        self.assertEqual(security["symbol"], "MSFT")
        first = self.client.post(f"{API}/watchlists/", {"name": "Core"}, content_type="application/json")
        second = self.client.post(f"{API}/watchlists/", {"name": "Ideas"}, content_type="application/json")
        self.assertEqual((first.status_code, second.status_code), (201, 201))
        watchlist = f"{API}/watchlists/{first.json()['id']}"
        self.assertEqual(self.client.patch(
            f"{watchlist}/", {"name": "ideas"}, content_type="application/json"
        ).status_code, 409)
        self.assertEqual(self.client.patch(
            f"{watchlist}/", {"name": "Core holdings"}, content_type="application/json"
        ).json()["name"], "Core holdings")
        entry = self.client.post(
            f"{watchlist}/entries/", {"security_id": security["id"]}, content_type="application/json"
        )
        self.assertEqual(entry.status_code, 201)
        note_url = f"{API}/securities/{security['id']}/note/"
        self.assertEqual(self.client.put(
            note_url, {"text": "Review cloud growth."}, content_type="application/json"
        ).json(), {"text": "Review cloud growth."})
        self.assertEqual(self.client.delete(f"{watchlist}/entries/{entry.json()['id']}/").status_code, 204)
        self.assertEqual(self.client.get(note_url).json(), {"text": "Review cloud growth."})
        self.assertEqual(len(self.client.get(f"{API}/watchlists/").json()), 2)

        self.client.force_login(self.bob)
        self.assertEqual(self.client.get(f"{API}/watchlists/").json(), [])
        self.assertEqual(self.client.delete(f"{watchlist}/").status_code, 404)
        self.assertEqual(self.client.post(
            f"{watchlist}/entries/", {"security_id": security["id"]}, content_type="application/json"
        ).status_code, 404)
        self.assertEqual(self.client.get(note_url).json(), {"text": ""})

    @skipUnless(connection.vendor == "postgresql", "PostgreSQL row policies require PostgreSQL")
    def test_restricted_database_role_cannot_read_or_write_another_account(self):
        with owner_scope(self.alice.pk):
            watchlist = Watchlist.objects.create(owner=self.alice, name="Core")
            WatchlistEntry.objects.create(watchlist=watchlist, security=self.security)
            SecurityNote.objects.create(owner=self.alice, security=self.security, text="Private")

        # Postgres CI uses an administrator to create the test database. Exercise
        # policies explicitly as a role that owns neither the schema nor its tables.
        with connection.cursor() as cursor:
            cursor.execute("CREATE ROLE thesiswatch_test_runtime NOLOGIN NOBYPASSRLS")
            cursor.execute("GRANT USAGE ON SCHEMA public TO thesiswatch_test_runtime")
            cursor.execute(
                "GRANT SELECT, INSERT, UPDATE, DELETE ON core_watchlist, core_watchlistentry, "
                "core_securitynote, core_security TO thesiswatch_test_runtime"
            )
            cursor.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO thesiswatch_test_runtime")
            cursor.execute("SET LOCAL ROLE thesiswatch_test_runtime")
        try:
            self.assertEqual(Watchlist.objects.count(), 0)
            with owner_scope(self.alice.pk):
                self.assertEqual(Watchlist.objects.count(), 1)
                self.assertEqual(WatchlistEntry.objects.count(), 1)
                self.assertEqual(SecurityNote.objects.count(), 1)
                with owner_scope(self.bob.pk):
                    self.assertEqual(Watchlist.objects.count(), 0)
                    self.assertEqual(WatchlistEntry.objects.count(), 0)
                    self.assertEqual(SecurityNote.objects.count(), 0)
                self.assertEqual(Watchlist.objects.count(), 1)
            self.assertEqual(Watchlist.objects.count(), 0)
            with self.assertRaises(DatabaseError), transaction.atomic(), owner_scope(self.bob.pk):
                WatchlistEntry.objects.create(watchlist=watchlist, security=self.security)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("RESET ROLE")
