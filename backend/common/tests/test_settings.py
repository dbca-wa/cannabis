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

    def test_get_allowed_for_any_app_user(self, botanist_client):
        # Settings (incl. pricing) are viewable by anyone with an app role.
        resp = botanist_client.get(reverse("system-settings"))
        assert resp.status_code == 200

    def test_get_allowed_without_an_app_role_to_view_read_only(self, roleless_client):
        resp = roleless_client.get(reverse("system-settings"))
        assert resp.status_code == 200
        assert "cost_per_certificate" in resp.data

    def test_get_refused_when_signed_out(self, api_client):
        assert api_client.get(reverse("system-settings")).status_code in (401, 403)

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

    def test_non_staff_cannot_change_a_system_flag(self, botanist_client):
        resp = botanist_client.patch(
            reverse("system-settings"), {"ocr_enabled": True}, format="json"
        )
        assert resp.status_code == 403
        assert "administrator" in str(resp.data["detail"])
        assert SystemSettings.load().ocr_enabled is False


class TestWhoCanChangeSettings:
    """Finance officers, botanists and administrators can change rates,
    numbering and case defaults. System flags and email settings stay with
    administrators, and anyone without an app role cannot change anything."""

    @pytest.fixture(autouse=True)
    def _no_throttle(self, settings):
        rest = dict(settings.REST_FRAMEWORK)
        rest["DEFAULT_THROTTLE_RATES"] = {
            **rest.get("DEFAULT_THROTTLE_RATES", {}),
            "system_settings": None,
        }
        settings.REST_FRAMEWORK = rest

    def _patch(self, client, data):
        return client.patch(reverse("system-settings"), data, format="json")

    @pytest.mark.parametrize("role_client", ["finance_client", "botanist_client"])
    def test_an_app_role_can_change_rates_numbering_and_defaults(
        self, role_client, request, system_settings
    ):
        client = request.getfixturevalue(role_client)

        resp = self._patch(
            client,
            {
                "cost_per_certificate": "120.00",
                "cost_per_bag": "15.00",
                "tax_percentage": "10.00",
                "certificate_counter": 42,
                "default_print_requesting_rank": True,
            },
        )

        assert resp.status_code == 200
        saved = SystemSettings.load()
        assert str(saved.cost_per_certificate) == "120.00"
        assert saved.certificate_counter == 42
        assert saved.default_print_requesting_rank is True

    @pytest.mark.parametrize(
        "field, value",
        [
            ("ocr_enabled", True),
            ("allow_saved_searches", True),
            ("forward_certificate_emails_to", "someone@dbca.wa.gov.au"),
            ("send_emails_to_self", False),
            ("email_testing_mode", True),
        ],
    )
    def test_system_flags_and_email_settings_stay_with_admins(
        self, field, value, finance_client, system_settings
    ):
        before = getattr(SystemSettings.load(), field)

        resp = self._patch(finance_client, {"cost_per_bag": "99.00", field: value})

        assert resp.status_code == 403
        saved = SystemSettings.load()
        # Nothing in a refused request is saved, not even the allowed field.
        assert getattr(saved, field) == before
        assert str(saved.cost_per_bag) != "99.00"

    def test_an_admin_can_change_everything(self, admin_client, system_settings):
        resp = self._patch(
            admin_client,
            {"cost_per_bag": "12.00", "allow_saved_searches": True},
        )

        assert resp.status_code == 200
        assert SystemSettings.load().allow_saved_searches is True

    def test_no_app_role_cannot_change_anything(self, roleless_client, system_settings):
        resp = self._patch(roleless_client, {"cost_per_bag": "99.00"})

        assert resp.status_code == 403
        assert str(SystemSettings.load().cost_per_bag) != "99.00"


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

    def test_roleless_users_can_read_flags(self, roleless_client):
        # Every page reads them, including the Dashboard a roleless user sees.
        resp = roleless_client.get(reverse("system-feature-flags"))
        assert resp.status_code == 200
        assert "allow_saved_searches" in resp.data

    def test_signed_out_users_cannot(self, api_client):
        resp = api_client.get(reverse("system-feature-flags"))
        assert resp.status_code in (401, 403)
