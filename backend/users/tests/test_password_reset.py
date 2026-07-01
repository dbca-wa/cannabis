"""Tests for the password-reset flow: forgot-password and verify-reset-code."""

import re
from unittest.mock import patch

import pytest
from django.urls import reverse

from users.models import PasswordResetCode
from users.services import PasswordResetCodeService

pytestmark = pytest.mark.django_db

SEND = "common.services.email_service.send_email_with_embedded_image"


class TestForgotPassword:
    def test_existing_user_generic_success(self, api_client, botanist_user):
        with patch(SEND):
            resp = api_client.post(
                reverse("forgot_password"),
                {"email": botanist_user.email},
                format="json",
            )
        assert resp.status_code == 200
        assert resp.data["success"] is True
        assert PasswordResetCode.objects.filter(user=botanist_user).exists()

    def test_nonexistent_user_no_enumeration(self, api_client):
        with patch(SEND):
            resp = api_client.post(
                reverse("forgot_password"),
                {"email": "nobody@example.com"},
                format="json",
            )
        # Same generic success response regardless of account existence.
        assert resp.status_code == 200
        assert resp.data["success"] is True

    def test_email_contains_code_and_absolute_link(self, api_client, botanist_user):
        with patch(SEND) as mock_send:
            api_client.post(
                reverse("forgot_password"),
                {"email": botanist_user.email},
                format="json",
            )
        assert mock_send.called
        html = mock_send.call_args.kwargs.get("html_content", "")
        assert re.search(r"\b\d{4}\b", html)  # 4-digit reset code rendered
        assert "/auth/reset-code" in html  # reset link present
        assert "http" in html  # link is absolute, not a relative path


class TestVerifyResetCode:
    def test_valid_code_authenticates(self, api_client, botanist_user):
        reset_code = PasswordResetCodeService.generate_reset_code(botanist_user)
        resp = api_client.post(
            reverse("verify_reset_code"),
            {"email": botanist_user.email, "code": reset_code._plain_code},
            format="json",
        )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert resp.data["requires_password_change"] is True

    def test_invalid_code_rejected(self, api_client, botanist_user):
        reset_code = PasswordResetCodeService.generate_reset_code(botanist_user)
        wrong = "1234" if reset_code._plain_code != "1234" else "5678"
        resp = api_client.post(
            reverse("verify_reset_code"),
            {"email": botanist_user.email, "code": wrong},
            format="json",
        )
        assert resp.status_code == 400

    def test_malformed_code_rejected(self, api_client, botanist_user):
        resp = api_client.post(
            reverse("verify_reset_code"),
            {"email": botanist_user.email, "code": "12"},
            format="json",
        )
        assert resp.status_code == 400
