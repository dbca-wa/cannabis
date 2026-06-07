"""Tests for SystemSettingsView (GET and PATCH)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def settings_url():
    """URL for system settings endpoint."""
    return reverse("system-settings")


@pytest.mark.django_db
class TestSystemSettingsView:
    """Tests for SystemSettingsView."""

    def test_get_settings_as_admin(self, admin_client, settings_url):
        """GET settings as admin returns settings data."""
        response = admin_client.get(settings_url)

        assert response.status_code == status.HTTP_200_OK
        assert "cost_per_certificate" in response.data
        assert "cost_per_bag" in response.data
        assert "tax_percentage" in response.data
        assert "forward_certificate_emails_to" in response.data

    def test_get_settings_as_regular_user(self, authenticated_client, settings_url):
        """GET settings as non-admin returns 403."""
        response = authenticated_client.get(settings_url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_pricing_fields(self, admin_client, settings_url):
        """PATCH pricing fields updates settings."""
        response = admin_client.patch(
            settings_url,
            {
                "cost_per_certificate": "150.00",
                "cost_per_bag": "25.00",
                "tax_percentage": "10.00",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["cost_per_certificate"] == "150.00"

    def test_patch_invalid_pricing(self, admin_client, settings_url):
        """PATCH with invalid pricing returns validation error."""
        response = admin_client.patch(
            settings_url,
            {"cost_per_certificate": "invalid"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_negative_pricing(self, admin_client, settings_url):
        """PATCH with negative pricing returns validation error."""
        response = admin_client.patch(
            settings_url,
            {"cost_per_certificate": "-5.00"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_email_field(self, admin_client, settings_url):
        """PATCH email field updates forward email."""
        response = admin_client.patch(
            settings_url,
            {"forward_certificate_emails_to": "newemail@example.com"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_patch_invalid_email(self, admin_client, settings_url):
        """PATCH with invalid email returns validation error."""
        response = admin_client.patch(
            settings_url,
            {"forward_certificate_emails_to": "not-an-email"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_send_emails_to_self(self, admin_client, settings_url):
        """PATCH send_emails_to_self boolean field."""
        response = admin_client.patch(
            settings_url,
            {"send_emails_to_self": True},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_patch_as_regular_user(self, authenticated_client, settings_url):
        """PATCH as non-admin returns 403."""
        response = authenticated_client.patch(
            settings_url,
            {"cost_per_certificate": "100.00"},
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_email_testing_mode(self, admin_client, settings_url):
        """PATCH email_testing_mode field."""
        response = admin_client.patch(
            settings_url,
            {"email_testing_mode": True},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_patch_email_test_user(self, admin_client, settings_url, superuser):
        """PATCH email_test_user field with valid user."""
        response = admin_client.patch(
            settings_url,
            {"email_test_user": superuser.pk},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_patch_email_test_user_null(self, admin_client, settings_url):
        """PATCH email_test_user to null."""
        response = admin_client.patch(
            settings_url,
            {"email_test_user": None},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_patch_too_many_decimal_places(self, admin_client, settings_url):
        """PATCH with too many decimal places returns error."""
        response = admin_client.patch(
            settings_url,
            {"cost_per_certificate": "100.123"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_exceeds_max(self, admin_client, settings_url):
        """PATCH with value exceeding max returns error."""
        response = admin_client.patch(
            settings_url,
            {"cost_per_certificate": "9999999.99"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
