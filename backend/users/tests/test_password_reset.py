"""Tests for password validation, forgot password, and WhoAmI views."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestPasswordValidationView:
    """Tests for PasswordValidationView."""

    def test_strong_password(self, api_client):
        """POST with strong password returns valid strength info."""
        url = reverse("validate_password")
        response = api_client.post(url, {"password": "StrongPass123!"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_valid"] is True
        assert response.data["strength_level"] == "strong"
        assert response.data["score"] == 100

    def test_weak_password_too_short(self, api_client):
        """POST with short password returns errors."""
        url = reverse("validate_password")
        response = api_client.post(url, {"password": "Ab1!"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_valid"] is False
        assert len(response.data["errors"]) > 0

    def test_password_no_special_char(self, api_client):
        """POST with password missing special char."""
        url = reverse("validate_password")
        response = api_client.post(url, {"password": "LongPassword123"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_valid"] is False
        assert response.data["requirements"]["has_special"] is False

    def test_password_no_number(self, api_client):
        """POST with password missing number."""
        url = reverse("validate_password")
        response = api_client.post(url, {"password": "LongPassword!!"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_valid"] is False
        assert response.data["requirements"]["has_number"] is False

    def test_empty_password(self, api_client):
        """POST with empty password returns 400."""
        url = reverse("validate_password")
        response = api_client.post(url, {"password": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestForgotPasswordView:
    """Tests for ForgotPasswordView."""

    @patch(
        "users.throttles.PasswordResetEmailThrottle.allow_request", return_value=True
    )
    @patch("django.core.mail.send_mail", return_value=1)
    @patch("django.template.loader.render_to_string", return_value="<p>Reset code</p>")
    def test_forgot_password_valid_email(
        self, mock_render, mock_send_mail, mock_throttle, api_client, user
    ):
        """POST with valid email sends reset code."""
        url = reverse("forgot_password")
        response = api_client.post(url, {"email": user.email}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "reset code" in response.data["message"].lower()

    @patch(
        "users.throttles.PasswordResetEmailThrottle.allow_request", return_value=True
    )
    def test_forgot_password_nonexistent_email(self, mock_throttle, api_client):
        """POST with non-existent email still returns success (prevents enumeration)."""
        url = reverse("forgot_password")
        response = api_client.post(
            url, {"email": "nonexistent@example.com"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True

    def test_forgot_password_empty_email(self, api_client):
        """POST with empty email returns validation error."""
        url = reverse("forgot_password")
        response = api_client.post(url, {"email": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestWhoAmI:
    """Tests for WhoAmI view."""

    def test_whoami_authenticated(self, authenticated_client, user):
        """GET whoami as authenticated user returns user data."""
        url = reverse("whoami")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email

    def test_whoami_anonymous(self, api_client):
        """GET whoami as anonymous user returns anonymous response."""
        url = reverse("whoami")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_authenticated"] is False
        assert response.data["id"] is None
        assert response.data["initials"] == "?"
