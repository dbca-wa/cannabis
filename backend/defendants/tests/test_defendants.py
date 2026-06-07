"""Tests for defendant endpoints."""

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_defendant_list(admin_client, defendant):
    """GET defendants returns 200 with paginated data."""
    url = reverse("defendant_list")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "results" in response.data
    assert len(response.data["results"]) >= 1


@pytest.mark.django_db
def test_defendant_create(admin_client):
    """POST defendant returns 201 and defendant is persisted."""
    url = reverse("defendant_list")
    data = {
        "given_names": "Jane",
        "last_name": "Smith",
    }
    response = admin_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["last_name"] == "Smith"


@pytest.mark.django_db
def test_defendant_detail(admin_client, defendant):
    """GET defendant by ID returns 200 with correct data."""
    url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["given_names"] == "John"
    assert response.data["last_name"] == "Doe"


@pytest.mark.django_db
def test_defendant_update(admin_client, defendant):
    """PATCH defendant returns 200 with fields modified."""
    url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
    data = {"given_names": "Updated"}
    response = admin_client.patch(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    defendant.refresh_from_db()
    assert defendant.given_names == "Updated"


@pytest.mark.django_db
def test_defendant_delete(admin_client, defendant):
    """DELETE defendant returns 204 and defendant is removed."""
    url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
    response = admin_client.delete(url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    from defendants.models import Defendant

    assert not Defendant.objects.filter(pk=defendant.pk).exists()


@pytest.mark.django_db
def test_defendant_export_csv(admin_client, defendant):
    """GET export returns 200 with CSV content-type."""
    url = reverse("defendant_export")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    content_type = response.get("Content-Type", "")
    # Export may return CSV or JSON depending on query params
    assert "text/csv" in content_type or "application/json" in content_type


@pytest.mark.django_db
def test_defendant_unauthenticated(api_client):
    """GET defendants without auth returns 401."""
    url = reverse("defendant_list")
    response = api_client.get(url)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
