"""Service layer for system settings management."""

import logging
from decimal import Decimal, InvalidOperation

from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework.exceptions import ValidationError as DRFValidationError

from ..models import SystemSettings

logger = logging.getLogger(__name__)

# Field validation rules for pricing settings
PRICING_FIELD_RULES = {
    "cost_per_certificate": {
        "min": Decimal("0.00"),
        "max": Decimal("999999.99"),
        "decimal_places": 2,
        "field_name": "Certificate cost",
    },
    "cost_per_bag": {
        "min": Decimal("0.00"),
        "max": Decimal("999999.99"),
        "decimal_places": 2,
        "field_name": "Bag identification cost",
    },
    "tax_percentage": {
        "min": Decimal("0.00"),
        "max": Decimal("100.00"),
        "decimal_places": 2,
        "field_name": "Tax percentage",
    },
}


class SettingsService:
    """Business logic for system settings retrieval and updates."""

    @staticmethod
    def get_settings():
        """Load and return the singleton SystemSettings instance."""
        return SystemSettings.load()

    @staticmethod
    def get_environment():
        """Return the current environment name (lowercased)."""
        return getattr(django_settings, "ENVIRONMENT", "local").lower()

    @staticmethod
    def build_settings_response(settings_obj):
        """Build the response dictionary for system settings.

        Args:
            settings_obj: The SystemSettings instance.

        Returns:
            dict: Serialised settings data including audit info.
        """
        environment = SettingsService.get_environment()

        response_data = {
            "cost_per_certificate": str(settings_obj.cost_per_certificate),
            "cost_per_bag": str(settings_obj.cost_per_bag),
            "tax_percentage": str(settings_obj.tax_percentage),
            "forward_certificate_emails_to": settings_obj.forward_certificate_emails_to,
            "send_emails_to_self": settings_obj.send_emails_to_self,
            "email_testing_mode": settings_obj.email_testing_mode,
            "ocr_enabled": settings_obj.ocr_enabled,
            "email_test_user": None,
            "environment": environment,
            "send_emails_to_self_editable": SystemSettings.is_send_emails_to_self_editable(),
        }

        if settings_obj.email_test_user:
            response_data["email_test_user"] = {
                "id": settings_obj.email_test_user.id,
                "email": settings_obj.email_test_user.email,
                "given_names": settings_obj.email_test_user.given_names,
                "last_name": settings_obj.email_test_user.last_name,
            }

        if settings_obj.last_modified_by:
            response_data["last_modified_by"] = {
                "id": settings_obj.last_modified_by.id,
                "email": settings_obj.last_modified_by.email,
                "given_names": settings_obj.last_modified_by.given_names,
                "last_name": settings_obj.last_modified_by.last_name,
            }
        else:
            response_data["last_modified_by"] = None

        if settings_obj.last_modified_at:
            response_data["last_modified_at"] = (
                settings_obj.last_modified_at.isoformat()
            )
        else:
            response_data["last_modified_at"] = None

        return response_data

    @staticmethod
    def _validate_pricing_field(field_name, raw_value, rules):
        """Validate a single pricing field value.

        Args:
            field_name: The model field name.
            raw_value: The raw input value from the request.
            rules: Validation rules dict (min, max, decimal_places, field_name).

        Returns:
            tuple: (Decimal value or None, error message or None)
        """
        field_display_name = rules["field_name"]

        try:
            input_value = str(raw_value).strip()

            if not input_value:
                return None, f"{field_display_name} is required"

            value = Decimal(input_value)

            if not value.is_finite():
                return None, f"{field_display_name} must be a valid number"

            if value.as_tuple().exponent < -rules["decimal_places"]:
                decimal_text = (
                    "decimal place"
                    if rules["decimal_places"] == 1
                    else "decimal places"
                )
                return (
                    None,
                    f"{field_display_name} can have at most "
                    f"{rules['decimal_places']} {decimal_text}",
                )

            if value < rules["min"]:
                return None, f"{field_display_name} must be at least {rules['min']}"

            if value > rules["max"]:
                return None, f"{field_display_name} must not exceed {rules['max']}"

            return value, None

        except (InvalidOperation, ValueError, TypeError):
            return None, f"{field_display_name} must be a valid number"

    @staticmethod
    def _validate_email_field(raw_value):
        """Validate the forward_certificate_emails_to field.

        Args:
            raw_value: The raw email input.

        Returns:
            tuple: (cleaned email string or None, error message or None)
        """
        email_value = str(raw_value).strip()

        if not email_value:
            return None, "Admin email address is required"

        if len(email_value) > 254:
            return None, "Email address is too long (maximum 254 characters)"

        try:
            validate_email(email_value)
            return email_value, None
        except ValidationError:
            return None, "Please enter a valid email address"

    @staticmethod
    def _parse_boolean(raw_value):
        """Parse a boolean value from various input representations.

        Args:
            raw_value: The raw input (str, bool, int, etc.)

        Returns:
            bool: The parsed boolean value.
        """
        if isinstance(raw_value, str):
            return raw_value.lower() in ("true", "1", "yes", "on")
        return bool(raw_value)

    @staticmethod
    def update_settings(settings_obj, data, user):
        """Validate and apply updates to system settings.

        Args:
            settings_obj: The SystemSettings instance to update.
            data: Dict of field names to new values.
            user: The user performing the update.

        Returns:
            SystemSettings: The updated settings instance.

        Raises:
            DRFValidationError: If any field fails validation.
        """
        validation_errors = {}
        updated_fields = []
        old_values = {}

        # Validate pricing fields
        for field_name, rules in PRICING_FIELD_RULES.items():
            if field_name in data:
                value, error = SettingsService._validate_pricing_field(
                    field_name, data[field_name], rules
                )
                if error:
                    validation_errors[field_name] = error
                else:
                    old_values[field_name] = getattr(settings_obj, field_name)
                    setattr(settings_obj, field_name, value)
                    updated_fields.append(field_name)

        # Validate email field
        if "forward_certificate_emails_to" in data:
            email_value, error = SettingsService._validate_email_field(
                data["forward_certificate_emails_to"]
            )
            if error:
                validation_errors["forward_certificate_emails_to"] = error
            else:
                old_values["forward_certificate_emails_to"] = (
                    settings_obj.forward_certificate_emails_to
                )
                settings_obj.forward_certificate_emails_to = email_value
                updated_fields.append("forward_certificate_emails_to")

        # Validate send_emails_to_self
        if "send_emails_to_self" in data:
            try:
                bool_value = SettingsService._parse_boolean(data["send_emails_to_self"])
                old_values["send_emails_to_self"] = settings_obj.send_emails_to_self
                settings_obj.send_emails_to_self = bool_value
                updated_fields.append("send_emails_to_self")
            except (ValueError, TypeError):
                validation_errors["send_emails_to_self"] = (
                    "Email routing setting must be true or false"
                )

        # Validate email_testing_mode
        if "email_testing_mode" in data:
            try:
                bool_value = SettingsService._parse_boolean(data["email_testing_mode"])
                old_values["email_testing_mode"] = settings_obj.email_testing_mode
                settings_obj.email_testing_mode = bool_value
                updated_fields.append("email_testing_mode")
            except (ValueError, TypeError):
                validation_errors["email_testing_mode"] = (
                    "Email testing mode must be true or false"
                )

        # Validate ocr_enabled feature flag
        if "ocr_enabled" in data:
            bool_value = SettingsService._parse_boolean(data["ocr_enabled"])
            old_values["ocr_enabled"] = settings_obj.ocr_enabled
            settings_obj.ocr_enabled = bool_value
            updated_fields.append("ocr_enabled")

        # Validate email_test_user
        if "email_test_user" in data:
            user_id = data["email_test_user"]
            if user_id is None or user_id == "":
                old_values["email_test_user"] = settings_obj.email_test_user
                settings_obj.email_test_user = None
                updated_fields.append("email_test_user")
            else:
                from django.contrib.auth import get_user_model

                User = get_user_model()
                try:
                    test_user = User.objects.get(pk=int(user_id))
                    old_values["email_test_user"] = settings_obj.email_test_user
                    settings_obj.email_test_user = test_user
                    updated_fields.append("email_test_user")
                except (User.DoesNotExist, ValueError, TypeError):
                    validation_errors["email_test_user"] = (
                        "Invalid user ID for email test user"
                    )

        # Raise validation errors if any
        if validation_errors:
            logger.warning(
                f"Settings validation failed for user {user.username}: "
                f"{validation_errors}"
            )
            formatted_errors = {
                field: [msg] if isinstance(msg, str) else msg
                for field, msg in validation_errors.items()
            }
            raise DRFValidationError(formatted_errors)

        # Persist changes
        if updated_fields:
            settings_obj.last_modified_by = user
            settings_obj.save(
                update_fields=updated_fields + ["last_modified_by", "last_modified_at"]
            )

            # Log changes
            changes_summary = []
            for field in updated_fields:
                old_val = old_values.get(field, "N/A")
                new_val = getattr(settings_obj, field)
                changes_summary.append(f"{field}: {old_val} → {new_val}")

            logger.info(
                f"System settings updated by {user.username} "
                f"(ID: {user.id}). Changes: {'; '.join(changes_summary)}"
            )

        return settings_obj
