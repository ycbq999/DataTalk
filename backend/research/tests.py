import json
from datetime import date, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from kombu.exceptions import OperationalError
from rest_framework.test import APIClient

from core.models import Security
from core.tenancy import owner_scope

from .models import DailyProviderUsage, ResearchRun, Thesis
from .provider import ResearchError, ResearchResult, _parse_result
from .service import LEASE_DURATION, claim_research, publish_thesis, recoverable_runs
from .tasks import run_research

FIRST_URL = "https://www.sec.gov/filing"
SECOND_URL = "https://investor.example.com/earnings"


def provider_response():
    report = {
        "summary": "The company faces a concentrated customer base.",
        "bull_case": "More diversified clients could improve stability.",
        "bear_case": "A large contract could expire without renewal.",
        "investment_horizon": "Three years.",
        "uncertainty": "Renewal terms could not be found.",
        "assumptions": ["Key customers remain under contract."],
        "catalysts": ["Renewal announcement."],
        "risks": ["Customer concentration."],
        "invalidation_conditions": ["Renewals deteriorate materially."],
        "evidence": [
            {
                "claim": "The filing names customer concentration as a risk.",
                "url": FIRST_URL,
                "published_at": "2025-01-01",
            },
            {
                "claim": "The company discussed contract renewal in earnings materials.",
                "url": SECOND_URL,
                "published_at": None,
            },
        ],
    }
    return {
        "id": "resp_test",
        "model": "sample-model",
        "status": "completed",
        "usage": {"input_tokens": 300, "output_tokens": 275, "total_tokens": 575},
        "output": [
            {
                "type": "web_search_call",
                "action": {"type": "search", "sources": [{"url": FIRST_URL}, {"url": SECOND_URL}]},
            },
            {
                "type": "message",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(report),
                        "annotations": [{"type": "url_citation", "url": FIRST_URL, "title": "SEC filing"}],
                    }
                ],
            },
        ],
    }


class CitationValidationTests(SimpleTestCase):
    def test_links_reports_to_provider_evidence(self):
        result = _parse_result(provider_response(), date(2026, 1, 1))
        self.assertEqual(result.sources[0]["title"], "SEC filing")
        self.assertEqual(result.sources[0]["published_at"], "2025-01-01")
        self.assertEqual(result.sources[0]["claims"], ["The filing names customer concentration as a risk."])
        self.assertEqual(result.usage["web_search_calls"], 1)

    def test_rejects_model_urls_that_are_absent_from_search_metadata(self):
        response = provider_response()
        response["output"][0]["action"]["sources"].pop()
        with self.assertRaisesRegex(ResearchError, "could not be matched"):
            _parse_result(response, date(2026, 1, 1))

    def test_rejects_non_https_links_even_if_provider_returned_them(self):
        response = provider_response()
        part = response["output"][1]["content"][0]
        report = json.loads(part["text"])
        unsafe_url = "http://investor.example.com/earnings"
        report["evidence"][1]["url"] = unsafe_url
        part["text"] = json.dumps(report)
        response["output"][0]["action"]["sources"][1]["url"] = unsafe_url
        with self.assertRaisesRegex(ResearchError, "could not be matched"):
            _parse_result(response, date(2026, 1, 1))


@override_settings(
    RESEARCH_ENABLED=True,
    OPENAI_API_KEY="test-key",
    CELERY_BROKER_URL="memory://",
    RESEARCH_DAILY_LIMIT=5,
    RESEARCH_GLOBAL_DAILY_LIMIT=25,
    RESEARCH_MAX_ATTEMPTS=2,
)
class ResearchWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = get_user_model().objects.create_user(username="research-owner")
        cls.other = get_user_model().objects.create_user(username="research-other")
        cls.security = Security.objects.create(exchange="NASDAQ", symbol="TWRCH", name="Test Company")
        cls.url = f"/api/v1/securities/{cls.security.pk}/research/"

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.owner)

    def submit(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.url, {}, format="json")

    @patch("research.tasks.run_research.apply_async")
    @patch("research.tasks.generate_thesis")
    def test_requests_execute_once_and_versions_are_private(self, generate, schedule):
        generate.return_value = _parse_result(provider_response(), date(2026, 1, 1))

        first = self.submit()
        repeated = self.submit()
        self.assertEqual(first.status_code, 202)
        self.assertEqual(repeated.data["id"], first.data["id"])
        schedule.assert_called_once()

        run_research(self.other.pk, first.data["id"])
        generate.assert_not_called()
        run_research(self.owner.pk, first.data["id"])
        run_research(self.owner.pk, first.data["id"])
        generate.assert_called_once()

        second = self.submit()
        run_research(self.owner.pk, second.data["id"])
        result = self.client.get(self.url)
        versions = [thesis["version"] for thesis in result.data["theses"]]
        self.assertEqual(versions, [2, 1])
        self.assertEqual(result.data["runs"][0]["status"], "succeeded")
        self.assertEqual(DailyProviderUsage.objects.get().calls, 2)

        self.client.force_login(self.other)
        other_result = self.client.get(self.url)
        self.assertEqual(other_result.data["runs"], [])
        self.assertEqual(other_result.data["theses"], [])

    @patch("research.tasks.run_research.apply_async", side_effect=OperationalError("queue down"))
    def test_broker_failure_is_visible_and_can_be_retried(self, schedule):
        first = self.submit()
        status = self.client.get(self.url).data["runs"][0]
        self.assertEqual(status["status"], "failed")
        self.assertIn("queue is unavailable", status["error"])
        schedule.side_effect = None
        second = self.submit()
        self.assertNotEqual(first.data["id"], second.data["id"])

    @patch("research.tasks.run_research.apply_async")
    def test_expired_worker_cannot_publish_after_another_attempt(self, _schedule):
        run_id = self.submit().data["id"]
        stale = claim_research(self.owner.pk, run_id)
        with owner_scope(self.owner.pk):
            ResearchRun.objects.filter(pk=run_id).update(
                lease_expires_at=timezone.now() - timedelta(seconds=1),
                last_dispatched_at=timezone.now() - 2 * LEASE_DURATION,
            )
        self.assertEqual(recoverable_runs(self.owner.pk), [run_id])
        current = claim_research(self.owner.pk, run_id)
        result = ResearchResult({}, [], "test-model", "resp_test", {})
        publish_thesis(self.owner.pk, stale, result)
        with owner_scope(self.owner.pk):
            self.assertFalse(Thesis.objects.filter(run_id=run_id).exists())
        publish_thesis(self.owner.pk, current, result)
        self.assertEqual(self.client.get(self.url).data["theses"][0]["version"], 1)

    @override_settings(RESEARCH_GLOBAL_DAILY_LIMIT=1)
    @patch("research.tasks.run_research.apply_async")
    @patch("research.tasks.generate_thesis")
    def test_global_cap_applies_to_jobs_queued_before_the_cap(self, generate, _schedule):
        first = self.submit().data["id"]
        self.client.force_login(self.other)
        second = self.submit().data["id"]
        generate.return_value = ResearchResult({}, [], "test-model", "resp_test", {})
        run_research(self.owner.pk, first)
        run_research(self.other.pk, second)
        generate.assert_called_once()
        result = self.client.get(self.url)
        self.assertEqual(result.data["runs"][0]["status"], "failed")
        self.assertIn("usage limit", result.data["runs"][0]["error"])

    @patch("research.tasks.run_research.apply_async")
    @patch("research.tasks.generate_thesis")
    def test_disabling_an_account_stops_queued_research(self, generate, _schedule):
        run_id = self.submit().data["id"]
        get_user_model().objects.filter(pk=self.owner.pk).update(is_active=False)
        run_research(self.owner.pk, run_id)
        generate.assert_not_called()
        with owner_scope(self.owner.pk):
            self.assertEqual(ResearchRun.objects.get(pk=run_id).status, "failed")

    @patch("research.tasks.run_research.apply_async")
    def test_postgres_runtime_role_cannot_read_other_owners_or_rewrite_theses(self, _schedule):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL RLS verification")
        with connection.cursor() as cursor:
            cursor.execute("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")
            if not cursor.fetchone()[0]:
                self.skipTest("RLS verification requires the ephemeral PostgreSQL CI administrator")
        run_id = self.submit().data["id"]
        attempt = claim_research(self.owner.pk, run_id)
        publish_thesis(self.owner.pk, attempt, ResearchResult({}, [], "test-model", "resp_test", {}))

        role = f"tw_research_test_{uuid4().hex}"
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE ROLE "{role}" NOLOGIN')
            cursor.execute(f'GRANT SELECT, UPDATE ON research_thesis, research_researchrun TO "{role}"')
            cursor.execute(f'SET LOCAL ROLE "{role}"')
        try:
            self.assertFalse(ResearchRun.objects.exists())
            with owner_scope(self.other.pk):
                self.assertFalse(ResearchRun.objects.exists())
                self.assertFalse(Thesis.objects.exists())
            with owner_scope(self.owner.pk):
                self.assertTrue(ResearchRun.objects.exists())
                self.assertTrue(Thesis.objects.exists())
                self.assertEqual(Thesis.objects.update(model="alternate"), 0)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("RESET ROLE")
