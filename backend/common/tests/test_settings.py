"""Tests for system settings + the OCR feature flag."""

import pytest
from django.urls import reverse

from common.models import SystemSettings

pytestmark = pytest.mark.django_db


class TestSystemSettings:
    def test_get_includes_ocr_enabled(self, admin_client):
        resp = admin_client.get(reverse("system-settings"))
        assert resp.status_code == 200
        assert "ocr_enabled" in resp.data

    def test_get_requires_staff(self, botanist_client):
        # Settings (incl. pricing) are admin-only.
        resp = botanist_client.get(reverse("system-settings"))
        assert resp.status_code == 403

    def test_admin_can_toggle_ocr_enabled(self, admin_client):
        resp = admin_client.patch(
            reverse("system-settings"), {"ocr_enabled": True}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["ocr_enabled"] is True
        assert SystemSettings.load().ocr_enabled is True

        resp = admin_client.patch(
            reverse("system-settings"), {"ocr_enabled": False}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["ocr_enabled"] is False

    def test_non_staff_cannot_patch(self, botanist_client):
        resp = botanist_client.patch(
            reverse("system-settings"), {"ocr_enabled": True}, format="json"
        )
        assert resp.status_code == 403


class TestFeatureFlags:
    """Feature flags are readable by any app user (not just admins)."""

    def test_botanist_can_read_flags(self, botanist_client):
        resp = botanist_client.get(reverse("system-feature-flags"))
        assert resp.status_code == 200
        assert "ocr_enabled" in resp.data

    def test_finance_can_read_flags(self, finance_client):
        resp = finance_client.get(reverse("system-feature-flags"))
        assert resp.status_code == 200
        assert "ocr_enabled" in resp.data

    def test_reflects_toggle(self, finance_client):
        settings_obj = SystemSettings.load()
        settings_obj.ocr_enabled = True
        settings_obj.save()
        resp = finance_client.get(reverse("system-feature-flags"))
        assert resp.data["ocr_enabled"] is True

    def test_roleless_blocked(self, roleless_client):
        resp = roleless_client.get(reverse("system-feature-flags"))
        assert resp.status_code == 403
