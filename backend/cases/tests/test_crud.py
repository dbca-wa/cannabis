"""Tests for submission CRUD operations."""

import pytest
from django.urls import reverse
from django.utils import timezone

from cases.models import Submission


@pytest.mark.django_db
def test_submission_list(authenticated_client, submission):
    """GET submissions list returns 200 with paginated data."""
    url = reverse("case_list")
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert "results" in response.data
    assert "count" in response.data
    assert response.data["count"] >= 1


@pytest.mark.django_db
def test_submission_create_draft(authenticated_client, police_officer):
    """POST to submissions endpoint creates a new submission."""
    url = reverse("case_list")
    data = {
        "case_number": "NEW-CASE-001",
        "received": timezone.now().isoformat(),
        "security_movement_envelope": "ENV-NEW-001",
        "requesting_officer": police_officer.pk,
    }
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == 201
    assert Submission.objects.filter(case_number="NEW-CASE-001").exists()


@pytest.mark.django_db
def test_submission_detail(authenticated_client, submission):
    """GET submission by ID returns 200 with all fields."""
    url = reverse("case_detail", kwargs={"pk": submission.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert response.data["case_number"] == submission.case_number


@pytest.mark.django_db
def test_submission_update(authenticated_client, submission):
    """PATCH submission updates fields."""
    url = reverse("case_detail", kwargs={"pk": submission.pk})
    data = {"internal_comments": "Updated comment"}
    response = authenticated_client.patch(url, data, format="json")

    assert response.status_code == 200
    submission.refresh_from_db()
    assert submission.internal_comments == "Updated comment"


@pytest.mark.django_db
def test_submission_search_case_number(authenticated_client, submission):
    """GET with search param filters results by case number."""
    url = reverse("case_list")
    response = authenticated_client.get(url, {"search": "TEST-001"})

    assert response.status_code == 200
    assert response.data["count"] >= 1
    results = response.data["results"]
    assert any(r["case_number"] == "TEST-001" for r in results)


@pytest.mark.django_db
def test_submission_ordering(authenticated_client, police_officer):
    """GET with ordering param returns sorted results."""
    # Create submissions with different case numbers
    Submission.objects.create(
        case_number="AAA-001",
        received=timezone.now(),
        security_movement_envelope="ENV-A",
        requesting_officer=police_officer,
        phase=Submission.PhaseChoices.CASE_CREATION,
    )
    Submission.objects.create(
        case_number="ZZZ-001",
        received=timezone.now(),
        security_movement_envelope="ENV-Z",
        requesting_officer=police_officer,
        phase=Submission.PhaseChoices.CASE_CREATION,
    )

    url = reverse("case_list")
    response = authenticated_client.get(url, {"ordering": "case_number"})

    assert response.status_code == 200
    results = response.data["results"]
    case_numbers = [r["case_number"] for r in results]
    assert case_numbers == sorted(case_numbers)
