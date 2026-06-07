"""Tests for submission dashboard endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from cases.models import Submission
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def dash_finance_user(db):
    return User.objects.create_user(
        email="dash_finance@test.com",
        password="testpass123",
        first_name="Dash",
        last_name="Finance",
        role="finance",
    )


@pytest.fixture
def dash_submission(db, dash_finance_user):
    station = PoliceStation.objects.create(name="Dash Station", address="1 Dash St")
    officer = PoliceOfficer.objects.create(
        first_name="Dash",
        last_name="Officer",
        badge_number="DASH01",
        station=station,
    )
    return Submission.objects.create(
        case_number="DASH-001",
        received=timezone.now(),
        security_movement_envelope="ENV-DASH",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.INVOICING,
        finance_officer=dash_finance_user,
    )


@pytest.mark.django_db
def test_my_submissions(api_client, dash_finance_user, dash_submission):
    """GET my/ returns only submissions assigned to current user."""
    api_client.force_authenticate(user=dash_finance_user)
    url = reverse("my_cases")
    response = api_client.get(url)

    assert response.status_code == 200
    assert "results" in response.data
    assert response.data["count"] >= 1


@pytest.mark.django_db
def test_pending_attention(api_client, dash_finance_user, dash_submission):
    """GET pending-attention/ returns submissions requiring user action."""
    api_client.force_authenticate(user=dash_finance_user)
    url = reverse("pending_attention")
    response = api_client.get(url)

    assert response.status_code == 200
    # PendingAttentionView returns a list (not paginated)
    assert isinstance(response.data, list)
    assert len(response.data) >= 1


@pytest.mark.django_db
def test_certificate_stats(authenticated_client):
    """GET stats/certificates/ returns aggregate statistics."""
    url = reverse("certificate_stats")
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert "current_month" in response.data
    assert "count" in response.data["current_month"]


@pytest.mark.django_db
def test_revenue_stats(authenticated_client):
    """GET stats/revenue/ returns revenue summary data."""
    url = reverse("revenue_stats")
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert "current_month" in response.data
    assert "total" in response.data["current_month"]
