"""Tests for SystemSettings endpoints."""

import pytest
from django.urls import reverse

from common.models import SystemSettings


@pytest.mark.django_db
def test_get_settings_as_admin(admin_client):
    """GET system settings as admin returns 200 with settings object."""
    # Ensure settings exist
    SystemSettings.load()

    url = reverse("system-settings")
    response = admin_client.get(url)

    assert response.status_code == 200
    assert "cost_per_certificate" in response.data
    assert "cost_per_bag" in response.data
    assert "tax_percentage" in response.data


@pytest.mark.django_db
def test_update_settings_as_admin(admin_client):
    """PATCH system settings as admin returns 200 with persisted changes."""
    SystemSettings.load()

    url = reverse("system-settings")
    data = {"cost_per_certificate": "150.00"}
    response = admin_client.patch(url, data, format="json")

    assert response.status_code == 200
    assert response.data["cost_per_certificate"] == "150.00"

    # Verify persisted
    settings = SystemSettings.load()
    assert str(settings.cost_per_certificate) == "150.00"


@pytest.mark.django_db
def test_get_settings_as_regular_user(authenticated_client):
    """GET system settings as non-admin returns 403."""
    SystemSettings.load()

    url = reverse("system-settings")
    response = authenticated_client.get(url)

    assert response.status_code == 403
