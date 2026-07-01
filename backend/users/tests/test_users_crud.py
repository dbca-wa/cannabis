"""Tests for user management endpoints (list, detail, export)."""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


class TestUserManagement:
    def test_list_as_admin(self, admin_client):
        resp = admin_client.get(reverse("user_list"))
        assert resp.status_code == 200

    def test_list_blocked_for_roleless(self, roleless_client):
        resp = roleless_client.get(reverse("user_list"))
        assert resp.status_code == 403

    def test_detail(self, admin_client, botanist_user):
        resp = admin_client.get(reverse("user_detail", kwargs={"pk": botanist_user.pk}))
        assert resp.status_code == 200
        assert resp.data["email"] == botanist_user.email

    def test_export(self, admin_client):
        resp = admin_client.get(reverse("user_export"))
        assert resp.status_code == 200
