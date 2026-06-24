"""Tests for submission workflow — advance, send-back, and phase history."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from cases.models import Submission, SubmissionPhaseHistory
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def workflow_station(db):
    return PoliceStation.objects.create(
        name="Workflow Station", address="1 Workflow St"
    )


@pytest.fixture
def workflow_officer(db, workflow_station):
    return PoliceOfficer.objects.create(
        first_name="Workflow",
        last_name="Officer",
        badge_number="WF001",
        station=workflow_station,
    )


@pytest.fixture
def workflow_submission(db, workflow_officer):
    """Submission in INVOICING phase for workflow tests."""
    return Submission.objects.create(
        case_number="WF-001",
        received=timezone.now(),
        security_movement_envelope="ENV-WF-001",
        requesting_officer=workflow_officer,
        phase=Submission.PhaseChoices.INVOICING,
    )


@pytest.fixture
def wf_finance_user(db):
    return User.objects.create_user(
        email="wf_finance@test.com",
        password="testpass123",
        first_name="Finance",
        last_name="WF",
        role="finance",
    )


@pytest.fixture
def wf_botanist_user(db):
    return User.objects.create_user(
        email="wf_botanist@test.com",
        password="testpass123",
        first_name="Botanist",
        last_name="WF",
        role="botanist",
    )


@pytest.fixture
def wf_regular_user(db):
    return User.objects.create_user(
        email="wf_regular@test.com",
        password="testpass123",
        first_name="Regular",
        last_name="WF",
        role="none",
    )


@pytest.mark.django_db
def test_advance_phase(admin_client, workflow_submission):
    """POST workflow advance updates phase and returns 200."""
    url = reverse("case_workflow", kwargs={"pk": workflow_submission.pk})
    data = {"action": "advance_phase"}
    response = admin_client.post(url, data, format="json")

    assert response.status_code == 200
    assert response.data["new_phase"] == Submission.PhaseChoices.SEND_EMAILS
    workflow_submission.refresh_from_db()
    assert workflow_submission.phase == Submission.PhaseChoices.SEND_EMAILS


@pytest.mark.django_db
def test_send_back(api_client, workflow_submission, wf_finance_user):
    """POST send-back with reason reverts phase and records history."""
    api_client.force_authenticate(user=wf_finance_user)
    url = reverse("case_send_back", kwargs={"pk": workflow_submission.pk})
    data = {
        "target_phase": "case_creation",
        "reason": "Missing defendant information",
    }
    response = api_client.post(url, data, format="json")

    assert response.status_code == 200
    assert response.data["new_phase"] == "case_creation"
    assert response.data["reason"] == "Missing defendant information"

    workflow_submission.refresh_from_db()
    assert workflow_submission.phase == Submission.PhaseChoices.CASE_CREATION

    # Verify history was recorded
    history = SubmissionPhaseHistory.objects.filter(
        submission=workflow_submission
    ).first()
    assert history is not None
    assert history.action == "send_back"
    assert history.reason == "Missing defendant information"


@pytest.mark.django_db
def test_send_back_any_authenticated_user(
    api_client, workflow_submission, wf_regular_user
):
    """POST send-back works for any authenticated user (only IsAuthenticated required)."""
    # The workflow view uses IsAuthenticated permission — any logged-in user
    # can send back a case as long as the phase transition is valid.
    api_client.force_authenticate(user=wf_regular_user)
    url = reverse("case_send_back", kwargs={"pk": workflow_submission.pk})
    data = {
        "target_phase": "case_creation",
        "reason": "Test reason",
    }
    response = api_client.post(url, data, format="json")

    assert response.status_code == 200


@pytest.mark.django_db
def test_send_back_invalid_phase(api_client, workflow_submission, wf_finance_user):
    """POST send-back to a later phase returns 400."""
    api_client.force_authenticate(user=wf_finance_user)
    url = reverse("case_send_back", kwargs={"pk": workflow_submission.pk})
    data = {
        "target_phase": "send_emails",
        "reason": "Invalid forward movement",
    }
    response = api_client.post(url, data, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_phase_history(api_client, workflow_submission, wf_finance_user):
    """GET phase-history returns chronological entries with user/action/reason."""
    # Create some history entries
    SubmissionPhaseHistory.objects.create(
        submission=workflow_submission,
        from_phase=Submission.PhaseChoices.CASE_CREATION,
        to_phase=Submission.PhaseChoices.INVOICING,
        action="advance",
        user=wf_finance_user,
    )
    SubmissionPhaseHistory.objects.create(
        submission=workflow_submission,
        from_phase=Submission.PhaseChoices.INVOICING,
        to_phase=Submission.PhaseChoices.CASE_CREATION,
        action="send_back",
        user=wf_finance_user,
        reason="Missing info",
    )

    api_client.force_authenticate(user=wf_finance_user)
    url = reverse(
        "case_phase_history",
        kwargs={"pk": workflow_submission.pk},
    )
    response = api_client.get(url)

    assert response.status_code == 200
    assert "results" in response.data
    assert len(response.data["results"]) == 2

    # Check that entries contain expected fields
    entry = response.data["results"][0]
    assert "from_phase" in entry
    assert "to_phase" in entry
    assert "action" in entry
    assert "user" in entry
    assert "timestamp" in entry
