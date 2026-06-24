"""Service-layer tests for SettingsService."""

from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError as DRFValidationError

from common.models import SystemSettings
from common.services.settings_service import SettingsService


@pytest.mark.django_db
class TestSettingsServiceBasics:
    """Tests for retrieval and helpers."""

    def test_get_settings_returns_singleton(self):
        result = SettingsService.get_settings()
        assert isinstance(result, SystemSettings)

    def test_get_environment(self):
        env = SettingsService.get_environment()
        assert isinstance(env, str)
        assert env == env.lower()

    def test_build_settings_response_basic(self):
        settings_obj = SystemSettings.load()
        data = SettingsService.build_settings_response(settings_obj)
        assert "cost_per_certificate" in data
        assert "tax_percentage" in data
        assert "environment" in data
        assert data["email_test_user"] is None
        assert data["last_modified_by"] is None

    def test_build_settings_response_with_test_user(self, user):
        settings_obj = SystemSettings.load()
        settings_obj.email_test_user = user
        settings_obj.last_modified_by = user
        settings_obj.save()
        data = SettingsService.build_settings_response(settings_obj)
        assert data["email_test_user"]["email"] == user.email
        assert data["last_modified_by"]["email"] == user.email
        assert data["last_modified_at"] is not None


@pytest.mark.django_db
class TestPricingFieldValidation:
    """Tests for _validate_pricing_field."""

    rules = {
        "min": Decimal("0.00"),
        "max": Decimal("999999.99"),
        "decimal_places": 2,
        "field_name": "Certificate cost",
    }

    def test_valid_value(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "110.00", self.rules
        )
        assert value == Decimal("110.00")
        assert error is None

    def test_empty_value(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "", self.rules
        )
        assert value is None
        assert "required" in error

    def test_too_many_decimals(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "10.123", self.rules
        )
        assert value is None
        assert "decimal" in error

    def test_below_min(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "-5.00", self.rules
        )
        assert value is None
        assert "at least" in error

    def test_above_max(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "9999999.00", self.rules
        )
        assert value is None
        assert "exceed" in error

    def test_invalid_number(self):
        value, error = SettingsService._validate_pricing_field(
            "cost_per_certificate", "abc", self.rules
        )
        assert value is None
        assert "valid number" in error


@pytest.mark.django_db
class TestEmailFieldValidation:
    """Tests for _validate_email_field."""

    def test_valid_email(self):
        value, error = SettingsService._validate_email_field("a@b.com")
        assert value == "a@b.com"
        assert error is None

    def test_empty_email(self):
        value, error = SettingsService._validate_email_field("")
        assert value is None
        assert "required" in error

    def test_too_long_email(self):
        long_email = "a" * 250 + "@b.com"
        value, error = SettingsService._validate_email_field(long_email)
        assert value is None
        assert "too long" in error

    def test_invalid_email(self):
        value, error = SettingsService._validate_email_field("not-an-email")
        assert value is None
        assert "valid email" in error


class TestParseBoolean:
    """Tests for _parse_boolean."""

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("true", True),
            ("True", True),
            ("1", True),
            ("yes", True),
            ("on", True),
            ("false", False),
            ("no", False),
            ("", False),
            (True, True),
            (False, False),
            (1, True),
            (0, False),
        ],
    )
    def test_parse_boolean(self, raw, expected):
        assert SettingsService._parse_boolean(raw) is expected


@pytest.mark.django_db
class TestUpdateSettings:
    """Tests for update_settings."""

    def test_update_pricing_fields(self, user):
        settings_obj = SystemSettings.load()
        result = SettingsService.update_settings(
            settings_obj,
            {"cost_per_certificate": "150.00", "cost_per_bag": "20.00"},
            user,
        )
        assert result.cost_per_certificate == Decimal("150.00")
        assert result.cost_per_bag == Decimal("20.00")

    def test_update_invalid_pricing_raises(self, user):
        settings_obj = SystemSettings.load()
        with pytest.raises(DRFValidationError):
            SettingsService.update_settings(
                settings_obj, {"cost_per_certificate": "abc"}, user
            )

    def test_update_email(self, user):
        settings_obj = SystemSettings.load()
        result = SettingsService.update_settings(
            settings_obj, {"forward_certificate_emails_to": "new@example.com"}, user
        )
        assert result.forward_certificate_emails_to == "new@example.com"

    def test_update_invalid_email_raises(self, user):
        settings_obj = SystemSettings.load()
        with pytest.raises(DRFValidationError):
            SettingsService.update_settings(
                settings_obj, {"forward_certificate_emails_to": "bad"}, user
            )

    def test_update_boolean_fields(self, user):
        settings_obj = SystemSettings.load()
        result = SettingsService.update_settings(
            settings_obj,
            {"email_testing_mode": "true"},
            user,
        )
        assert result.email_testing_mode is True

    def test_update_email_test_user_set(self, user):
        settings_obj = SystemSettings.load()
        result = SettingsService.update_settings(
            settings_obj, {"email_test_user": user.pk}, user
        )
        assert result.email_test_user_id == user.pk

    def test_update_email_test_user_clear(self, user):
        settings_obj = SystemSettings.load()
        settings_obj.email_test_user = user
        settings_obj.save()
        result = SettingsService.update_settings(
            settings_obj, {"email_test_user": ""}, user
        )
        assert result.email_test_user is None

    def test_update_email_test_user_invalid(self, user):
        settings_obj = SystemSettings.load()
        with pytest.raises(DRFValidationError):
            SettingsService.update_settings(
                settings_obj, {"email_test_user": 999999}, user
            )

    def test_update_records_modified_by(self, user):
        settings_obj = SystemSettings.load()
        result = SettingsService.update_settings(
            settings_obj, {"cost_per_bag": "30.00"}, user
        )
        assert result.last_modified_by_id == user.pk
        assert result.last_modified_at is not None
