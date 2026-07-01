"""Tests for the authentication endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import BotanistFactory

pytestmark = pytest.mark.django_db


class TestWhoAmI:
    def test_anonymous(self, api_client):
        resp = api_client.get(reverse("whoami"))
        assert resp.status_code == 200
        assert resp.data["is_authenticated"] is False
        assert resp.data["role"] == "none"

    def test_authenticated(self, api_client, botanist_user):
        api_client.force_authenticate(user=botanist_user)
        resp = api_client.get(reverse("whoami"))
        assert resp.status_code == 200
        assert resp.data["email"] == botanist_user.email


class TestLogin:
    def test_returns_tokens_and_user(self, api_client):
        BotanistFactory(email="login@example.com", password="testpass123")
        resp = api_client.post(
            reverse("login"),
            {"email": "login@example.com", "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data
        assert resp.data["user"]["email"] == "login@example.com"

    def test_invalid_credentials(self, api_client):
        BotanistFactory(email="login2@example.com", password="testpass123")
        resp = api_client.post(
            reverse("login"),
            {"email": "login2@example.com", "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 401


class TestPasswordValidation:
    def test_validate_password(self, api_client):
        resp = api_client.post(
            reverse("validate_password"),
            {"password": "SomeStr0ng!Pass"},
            format="json",
        )
        assert resp.status_code == 200


class TestPasswordUpdate:
    def test_requires_authentication(self, api_client):
        resp = api_client.post(reverse("update_password"), {}, format="json")
        assert resp.status_code in (401, 403)

    def test_updates_password(self, api_client, botanist_user):
        botanist_user.set_password("testpass123")
        botanist_user.save()
        api_client.force_authenticate(user=botanist_user)
        resp = api_client.post(
            reverse("update_password"),
            {
                "current_password": "testpass123",
                "new_password": "NewStr0ng!Pass",
                "confirm_password": "NewStr0ng!Pass",
            },
            format="json",
        )
        assert resp.status_code == 200
        botanist_user.refresh_from_db()
        assert botanist_user.check_password("NewStr0ng!Pass")


class TestLogout:
    def test_requires_authentication(self, api_client):
        resp = api_client.post(reverse("logout"), {"refresh_token": "x"}, format="json")
        assert resp.status_code in (401, 403)

    def test_logout_blacklists_refresh(self, api_client):
        user = BotanistFactory(email="logout@example.com", password="testpass123")
        login = api_client.post(
            reverse("login"),
            {"email": "logout@example.com", "password": "testpass123"},
            format="json",
        )
        refresh = login.data["refresh"]
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            reverse("logout"), {"refresh_token": refresh}, format="json"
        )
        assert resp.status_code == 200

        # The refresh token is blacklisted — it can no longer be exchanged.
        api_client.force_authenticate(user=None)
        refreshed = api_client.post(
            reverse("token_refresh"), {"refresh": refresh}, format="json"
        )
        assert refreshed.status_code == 401
