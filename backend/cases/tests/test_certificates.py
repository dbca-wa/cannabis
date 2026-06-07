"""Tests for certificate endpoints."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_certificate_list_for_submission(authenticated_client, submission, certificate):
    """GET certificates for submission returns 200 with paginated data."""
    url = reverse("certificate_list", kwargs={"pk": submission.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    # Response may be paginated or a list
    if isinstance(response.data, dict):
        assert "results" in response.data
        assert len(response.data["results"]) >= 1
    else:
        assert len(response.data) >= 1


@pytest.mark.django_db
def test_all_certificates_list(authenticated_client, certificate):
    """GET all-certificates flat list returns 200 with data."""
    url = reverse("all_certificates_list")
    response = authenticated_client.get(url)

    assert response.status_code == 200
    if isinstance(response.data, dict):
        assert "results" in response.data
        assert len(response.data["results"]) >= 1
    else:
        assert len(response.data) >= 1


@pytest.mark.django_db
def test_certificate_detail(authenticated_client, certificate):
    """GET certificate by ID returns 200 with correct data."""
    url = reverse("certificate_detail", kwargs={"pk": certificate.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert response.data["certificate_number"] == certificate.certificate_number
