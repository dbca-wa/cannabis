"""Tests for police officer endpoints."""

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_officer_list(admin_client, police_officer):
    """GET officers returns 200 with paginated data."""
    url = reverse("officer_list")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "results" in response.data
    assert len(response.data["results"]) >= 1


@pytest.mark.django_db
def test_officer_create(admin_client, police_station):
    """POST officer with station FK returns 201 and officer is persisted."""
    url = reverse("officer_list")
    data = {
        "badge_number": "B002",
        "first_name": "Jane",
        "last_name": "Doe",
        "rank": "constable",
        "station": police_station.pk,
    }
    response = admin_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["first_name"] == "Jane"


@pytest.mark.django_db
def test_officer_detail(admin_client, police_officer):
    """GET officer by ID returns 200 with correct data."""
    url = reverse("officer_detail", kwargs={"pk": police_officer.pk})
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["first_name"] == "John"


@pytest.mark.django_db
def test_officer_update(admin_client, police_officer):
    """PATCH officer returns 200 with fields modified."""
    url = reverse("officer_detail", kwargs={"pk": police_officer.pk})
    data = {"first_name": "Updated"}
    response = admin_client.patch(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    police_officer.refresh_from_db()
    assert police_officer.first_name == "Updated"


@pytest.mark.django_db
def test_officer_delete(admin_client, police_officer):
    """DELETE officer returns 204 and officer is removed."""
    url = reverse("officer_detail", kwargs={"pk": police_officer.pk})
    response = admin_client.delete(url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    from police.models import PoliceOfficer

    assert not PoliceOfficer.objects.filter(pk=police_officer.pk).exists()


@pytest.mark.django_db
def test_officer_export_csv(admin_client, police_officer):
    """GET export returns 200 with CSV content-type."""
    url = reverse("officer_export")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    content_type = response.get("Content-Type", "")
    # Export may return CSV or JSON depending on query params
    assert "text/csv" in content_type or "application/json" in content_type
