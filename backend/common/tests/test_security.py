"""Tests for security monitoring endpoints."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_security_monitoring_as_admin(admin_client):
    """GET security-monitoring as admin returns 200 with metrics."""
    url = reverse("security-monitoring")
    response = admin_client.get(url)

    assert response.status_code == 200
    assert "timestamp" in response.data
    assert "rate_limits" in response.data
    assert "brute_force_protection" in response.data


@pytest.mark.django_db
def test_reset_rate_limits_as_admin(admin_client):
    """POST reset-rate-limits as admin returns 200 with cleared confirmation."""
    url = reverse("reset-rate-limits")
    response = admin_client.post(url, format="json")

    assert response.status_code == 200
    assert "message" in response.data
    assert "cleared_by" in response.data


@pytest.mark.django_db
def test_security_monitoring_as_regular_user(authenticated_client):
    """GET security-monitoring as non-admin returns 403."""
    url = reverse("security-monitoring")
    response = authenticated_client.get(url)

    assert response.status_code == 403
