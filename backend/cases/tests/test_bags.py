"""Tests for drug bags and botanical assessments."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from cases.models import BotanicalAssessment, DrugBag

User = get_user_model()


@pytest.mark.django_db
def test_bag_list(authenticated_client, submission, drug_bag):
    """GET bags for submission returns 200 with data."""
    url = reverse("drugbag_list", kwargs={"pk": submission.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    # Response may be paginated or a list
    if isinstance(response.data, dict):
        assert "results" in response.data
        assert len(response.data["results"]) >= 1
    else:
        assert len(response.data) >= 1


@pytest.mark.django_db
def test_bag_create(authenticated_client, submission):
    """POST bag for submission creates a new bag."""
    url = reverse("drugbag_list", kwargs={"pk": submission.pk})
    data = {
        "submission": submission.pk,
        "seal_tag_numbers": "TAG-NEW-001",
        "content_type": "plant",
    }
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == 201
    assert DrugBag.objects.filter(seal_tag_numbers="TAG-NEW-001").exists()


@pytest.mark.django_db
def test_bag_update(authenticated_client, drug_bag):
    """PATCH bag updates fields."""
    url = reverse("drugbag_detail", kwargs={"pk": drug_bag.pk})
    data = {"new_seal_tag_numbers": "TAG-UPDATED"}
    response = authenticated_client.patch(url, data, format="json")

    assert response.status_code == 200
    drug_bag.refresh_from_db()
    assert drug_bag.new_seal_tag_numbers == "TAG-UPDATED"


@pytest.mark.django_db
def test_assessment_create(api_client, drug_bag, botanist_user):
    """POST assessment for bag creates a new assessment (botanist only)."""
    api_client.force_authenticate(user=botanist_user)
    url = reverse("assessment_create", kwargs={"drug_bag_id": drug_bag.pk})
    data = {
        "determination": "cannabis_sativa",
        "botanist_notes": "Confirmed cannabis sativa",
    }
    response = api_client.post(url, data, format="json")

    assert response.status_code == 201
    assert BotanicalAssessment.objects.filter(drug_bag=drug_bag).exists()


@pytest.mark.django_db
def test_assessment_detail(authenticated_client, botanical_assessment):
    """GET assessment by ID returns 200 with correct data."""
    url = reverse("assessment_detail", kwargs={"pk": botanical_assessment.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert response.data["determination"] == "cannabis_sativa"
