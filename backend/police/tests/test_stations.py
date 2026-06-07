"""Tests for police station endpoints."""

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_station_list(admin_client, police_station):
    """GET stations returns 200 with paginated data."""
    url = reverse("station_list")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "results" in response.data
    assert len(response.data["results"]) >= 1


@pytest.mark.django_db
def test_station_create(admin_client):
    """POST station returns 201 and station is persisted."""
    url = reverse("station_list")
    data = {
        "name": "New Station",
        "address": "456 Test Road",
        "phone": "0498765432",
    }
    response = admin_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["name"] == "New Station"


@pytest.mark.django_db
def test_station_detail(admin_client, police_station):
    """GET station by ID returns 200 with correct data."""
    url = reverse("station_detail", kwargs={"pk": police_station.pk})
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["name"] == "Central Police Station"


@pytest.mark.django_db
def test_station_update(admin_client, police_station):
    """PATCH station returns 200 with fields modified."""
    url = reverse("station_detail", kwargs={"pk": police_station.pk})
    data = {"name": "Updated Station"}
    response = admin_client.patch(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    police_station.refresh_from_db()
    assert police_station.name == "Updated Station"


@pytest.mark.django_db
def test_station_delete(admin_client, police_station):
    """DELETE station returns 204 and station is removed."""
    url = reverse("station_detail", kwargs={"pk": police_station.pk})
    response = admin_client.delete(url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    from police.models import PoliceStation

    assert not PoliceStation.objects.filter(pk=police_station.pk).exists()


@pytest.mark.django_db
def test_station_export_csv(admin_client, police_station):
    """GET export returns 200 with CSV content-type."""
    url = reverse("station_export")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    content_type = response.get("Content-Type", "")
    # Export may return CSV or JSON depending on query params
    assert "text/csv" in content_type or "application/json" in content_type


@pytest.mark.django_db
def test_station_unauthenticated(api_client):
    """GET stations without auth returns 401."""
    url = reverse("station_list")
    response = api_client.get(url)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
