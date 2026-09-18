"""The default botanist setting, and its eligibility guard.

The default is only honoured while the nominated user still holds the Approved
Botanist role, so a role change behaves as though nothing were set rather than
pre-selecting someone ineligible.
"""

import pytest

from common.models import SystemSettings
from common.tests.factories import BotanistFactory, FinanceFactory

pytestmark = pytest.mark.django_db

SETTINGS_URL = "/api/v1/system/settings"
FLAGS_URL = "/api/v1/system/feature-flags"


class TestReadingTheSetting:
    def test_reports_null_when_unset(self, admin_client, system_settings):
        response = admin_client.get(SETTINGS_URL)

        assert response.status_code == 200
        assert response.data["default_approved_botanist"] is None
        assert response.data["default_approved_botanist_details"] is None

    def test_reports_the_botanist_when_set(self, admin_client, system_settings):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])

        response = admin_client.get(SETTINGS_URL)

        assert response.data["default_approved_botanist"] == botanist.pk
        assert response.data["default_approved_botanist_details"]["id"] == botanist.pk

    def test_behaves_as_unset_once_the_user_loses_the_role(
        self, admin_client, system_settings
    ):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])

        botanist.role = botanist.RoleChoices.NONE
        botanist.save(update_fields=["role"])

        response = admin_client.get(SETTINGS_URL)

        assert response.data["default_approved_botanist"] is None
        assert response.data["default_approved_botanist_details"] is None


class TestWritingTheSetting:
    def test_an_admin_can_set_a_botanist(self, admin_client, system_settings):
        botanist = BotanistFactory()

        response = admin_client.patch(
            SETTINGS_URL,
            {"default_approved_botanist": botanist.pk},
            format="json",
        )

        assert response.status_code == 200
        system_settings.refresh_from_db()
        assert system_settings.default_approved_botanist_id == botanist.pk

    def test_it_can_be_cleared(self, admin_client, system_settings):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])

        response = admin_client.patch(
            SETTINGS_URL, {"default_approved_botanist": None}, format="json"
        )

        assert response.status_code == 200
        system_settings.refresh_from_db()
        assert system_settings.default_approved_botanist_id is None

    def test_a_user_without_the_role_is_rejected(self, admin_client, system_settings):
        finance = FinanceFactory()

        response = admin_client.patch(
            SETTINGS_URL,
            {"default_approved_botanist": finance.pk},
            format="json",
        )

        assert response.status_code == 400
        assert "default_approved_botanist" in response.data
        system_settings.refresh_from_db()
        assert system_settings.default_approved_botanist_id is None

    def test_an_unknown_user_is_rejected(self, admin_client, system_settings):
        response = admin_client.patch(
            SETTINGS_URL, {"default_approved_botanist": 999999}, format="json"
        )

        assert response.status_code == 400


class TestFeatureFlagsEndpoint:
    """Botanists read the default from here, since full settings are admin-only."""

    def test_exposes_the_default_to_a_botanist(self, botanist_client, system_settings):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])

        response = botanist_client.get(FLAGS_URL)

        assert response.status_code == 200
        assert response.data["default_approved_botanist"] == botanist.pk

    def test_reports_null_when_unset(self, botanist_client, system_settings):
        response = botanist_client.get(FLAGS_URL)

        assert response.data["default_approved_botanist"] is None

    def test_reports_null_once_the_user_loses_the_role(
        self, botanist_client, system_settings
    ):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])
        botanist.role = botanist.RoleChoices.NONE
        botanist.save(update_fields=["role"])

        response = botanist_client.get(FLAGS_URL)

        assert response.data["default_approved_botanist"] is None


class TestExistingCasesAreUnaffected:
    def test_changing_the_setting_does_not_touch_a_case(
        self, admin_client, system_settings
    ):
        from common.tests.factories import CaseFactory

        original = BotanistFactory()
        case = CaseFactory(approved_botanist=original)

        admin_client.patch(
            SETTINGS_URL,
            {"default_approved_botanist": BotanistFactory().pk},
            format="json",
        )

        case.refresh_from_db()
        assert case.approved_botanist_id == original.pk

    def test_removing_the_default_user_only_nulls_the_setting(self, system_settings):
        botanist = BotanistFactory()
        system_settings.default_approved_botanist = botanist
        system_settings.save(update_fields=["default_approved_botanist"])

        botanist.delete()

        settings_obj = SystemSettings.load()
        assert settings_obj.default_approved_botanist_id is None
