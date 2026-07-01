"""Tests for the invitation flow: invite, external search, and activation."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from users.models import InviteRecord

User = get_user_model()
pytestmark = pytest.mark.django_db

# EmailService renders the template, then calls this sender. Patching it lets the
# real render run (proving the template resolves) while capturing the HTML.
SEND = "common.services.email_service.send_email_with_embedded_image"


class TestInviteUser:
    def test_creates_record_and_sends_email(self, admin_client):
        with patch(SEND) as mock_send:
            resp = admin_client.post(
                reverse("invite_user"),
                {
                    "external_user_data": {
                        "email": "invitee@example.com",
                        "given_name": "In",
                        "surname": "Vitee",
                        "id": 4321,
                        "employee_id": "E1",
                    },
                    "role": "botanist",
                },
                format="json",
            )
        assert resp.status_code == 201
        assert InviteRecord.objects.filter(email="invitee@example.com").exists()
        assert mock_send.called
        html = mock_send.call_args.kwargs.get("html_content", "")
        assert "/auth/activate-invite/" in html

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.post(
            reverse("invite_user"),
            {"external_user_data": {"email": "x@example.com"}, "role": "botanist"},
            format="json",
        )
        assert resp.status_code == 403

    def test_rejects_existing_email(self, admin_client, botanist_user):
        with patch(SEND):
            resp = admin_client.post(
                reverse("invite_user"),
                {
                    "external_user_data": {"email": botanist_user.email},
                    "role": "botanist",
                },
                format="json",
            )
        # Existing user → 409 Conflict.
        assert resp.status_code == 409


class TestExternalUserSearch:
    def test_short_query_returns_empty(self, botanist_client):
        resp = botanist_client.get(reverse("external_user_search"), {"search": "a"})
        assert resp.status_code == 200
        assert resp.data["results"] == []

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("external_user_search"), {"search": "alice"})
        assert resp.status_code == 403

    def test_returns_filtered_external_users(self, botanist_client):
        fake_users = [
            {
                "id": 1,
                "given_name": "Alice",
                "surname": "Smith",
                "email": "alice@example.com",
                "employee_id": "E9",
                "title": "Botanist",
                "division": "Science",
                "unit": "Herbarium",
            }
        ]
        with patch("requests.get") as mock_get:
            mock_get.return_value.json.return_value = fake_users
            mock_get.return_value.raise_for_status.return_value = None
            resp = botanist_client.get(
                reverse("external_user_search"), {"search": "alice"}
            )
        assert resp.status_code == 200
        assert any(r["email"] == "alice@example.com" for r in resp.data["results"])


class TestInviteActivation:
    def _make_invite(self, inviter, **overrides):
        defaults = dict(
            email="newuser@example.com",
            invited_by=inviter,
            role="botanist",
            token="tok-valid-123",
            expires_at=timezone.now() + timedelta(hours=24),
            external_user_data={
                "given_name": "New",
                "surname": "User",
                "id": 99,
                "employee_id": "E2",
            },
        )
        defaults.update(overrides)
        return InviteRecord.objects.create(**defaults)

    def test_activate_creates_user_and_returns_tokens(self, api_client, admin_user):
        invite = self._make_invite(admin_user)
        resp = api_client.get(
            reverse("activate_invite", kwargs={"token": invite.token})
        )
        assert resp.status_code == 200
        assert "access" in resp.data and "refresh" in resp.data
        assert User.objects.filter(email="newuser@example.com").exists()
        invite.refresh_from_db()
        assert invite.is_used is True

    def test_invalid_token(self, api_client):
        resp = api_client.get(
            reverse("activate_invite", kwargs={"token": "does-not-exist"})
        )
        assert resp.status_code in (400, 404)

    def test_expired_token_rejected(self, api_client, admin_user):
        invite = self._make_invite(
            admin_user,
            email="expired@example.com",
            token="tok-expired",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        resp = api_client.get(
            reverse("activate_invite", kwargs={"token": invite.token})
        )
        assert resp.status_code in (400, 404, 410)
        assert not User.objects.filter(email="expired@example.com").exists()


class TestInviteEmailTool:
    """The /admin testing-route tool that sends a live invite email."""

    def test_sends_to_given_address_without_creating_records(self, admin_client):
        with patch(SEND) as mock_send:
            resp = admin_client.post(
                reverse("test_invite_email"),
                {"email": "preview@example.com", "role": "finance"},
                format="json",
            )
        assert resp.status_code == 200
        assert mock_send.called
        assert mock_send.call_args.kwargs["recipient_email"] == ["preview@example.com"]
        html = mock_send.call_args.kwargs.get("html_content", "")
        assert "/auth/activate-invite/" in html
        # No persistence — purely a preview send.
        assert not InviteRecord.objects.filter(email="preview@example.com").exists()
        assert not User.objects.filter(email="preview@example.com").exists()

    def test_defaults_to_current_user_email(self, admin_client, admin_user):
        with patch(SEND) as mock_send:
            resp = admin_client.post(
                reverse("test_invite_email"), {"role": "botanist"}, format="json"
            )
        assert resp.status_code == 200
        assert mock_send.call_args.kwargs["recipient_email"] == [admin_user.email]

    def test_rejects_invalid_role(self, admin_client):
        with patch(SEND):
            resp = admin_client.post(
                reverse("test_invite_email"),
                {"email": "x@example.com", "role": "wizard"},
                format="json",
            )
        assert resp.status_code == 400

    def test_forbidden_for_non_staff(self, finance_client):
        with patch(SEND):
            resp = finance_client.post(
                reverse("test_invite_email"),
                {"email": "x@example.com", "role": "finance"},
                format="json",
            )
        assert resp.status_code == 403
