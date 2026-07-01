"""Tests for the dashboard statistics endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import CaseFactory

pytestmark = pytest.mark.django_db


class TestDashboardStats:
    @pytest.mark.parametrize(
        "url_name",
        [
            "phase_counts",
            "revenue_stats",
            "monthly_throughput",
            "certificate_stats",
            "my_cases",
            "pending_attention",
        ],
    )
    def test_endpoint_returns_200(self, finance_client, url_name):
        resp = finance_client.get(reverse(url_name))
        assert resp.status_code == 200

    def test_phase_counts_reflects_data(self, finance_client):
        CaseFactory(phase="assessment")
        CaseFactory(phase="batching")
        resp = finance_client.get(reverse("phase_counts"))
        assert resp.status_code == 200
        assert resp.data is not None

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("phase_counts"))
        assert resp.status_code == 403
