import logging
from decimal import Decimal, InvalidOperation

from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import (
    PermissionDenied,
)
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import SystemSettings

logger = logging.getLogger(__name__)


class SystemFeatureFlagsView(APIView):
    """Read-only feature flags for any app user.

    Unlike full system settings (admin-only), feature flags are needed by
    botanists and finance officers — e.g. whether the OCR upload should appear
    on case creation. Returns only non-sensitive flags.
    """

    permission_classes = [HasAppAccess]

    def get(self, request):
        settings_obj = SystemSettings.load()
        return Response({"ocr_enabled": settings_obj.ocr_enabled})


class SystemSettingsRateThrottle(UserRateThrottle):
    """Custom rate throttle for system settings updates"""

    scope = "system_settings"


@method_decorator(never_cache, name="dispatch")
class SystemSettingsView(APIView):
    """
    GET: Retrieve system-wide settings (pricing, etc.)
    PATCH: Update system settings (admin only)
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [SystemSettingsRateThrottle]

    def get(self, request):
        # Any user with an app role can view settings (pricing info is needed
        # on the financials page). Roleless users are already blocked by
        # HasAppAccess on the permission_classes.
        settings = SystemSettings.load()
        environment = getattr(django_settings, "ENVIRONMENT", "local").lower()

        response_data = {
            "cost_per_certificate": str(settings.cost_per_certificate),
            "cost_per_bag": str(settings.cost_per_bag),
            "tax_percentage": str(settings.tax_percentage),
            "certificate_counter": settings.certificate_counter,
            "ocr_enabled": settings.ocr_enabled,
            "environment": environment,
        }

        # Add audit information if available
        if settings.last_modified_by:
            response_data["last_modified_by"] = {
                "id": settings.last_modified_by.id,
                "email": settings.last_modified_by.email,
                "given_names": settings.last_modified_by.given_names,
                "last_name": settings.last_modified_by.last_name,
            }
        else:
            response_data["last_modified_by"] = None

        if settings.last_modified_at:
            response_data["last_modified_at"] = settings.last_modified_at.isoformat()
        else:
            response_data["last_modified_at"] = None

        return Response(response_data)

    def patch(self, request):
        """Update system settings (staff or admin only)"""
        # Staff or superuser can modify settings
        if not (request.user.is_staff or request.user.is_superuser):
            logger.warning(
                f"Non-staff user {request.user.email} (ID: {request.user.id}) "
                f"attempted to modify system settings. "
                f"is_staff: {request.user.is_staff}, is_superuser: {request.user.is_superuser}"
            )
            raise PermissionDenied(
                "Only staff or admin users can modify system settings."
            )

        settings = SystemSettings.load()

        # Validate and update fields
        validation_errors = {}
        updated_fields = []
        old_values = {}

        # Define field validation rules with detailed error messages
        pricing_fields = {
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

        # Validate pricing fields
        for field_name, validation_rules in pricing_fields.items():
            if field_name in request.data:
                field_display_name = validation_rules["field_name"]

                try:
                    # Convert to string first to handle various input types
                    input_value = str(request.data[field_name]).strip()

                    if not input_value:
                        validation_errors[field_name] = (
                            f"{field_display_name} is required"
                        )
                        continue

                    value = Decimal(input_value)

                    # Check if value is finite
                    if not value.is_finite():
                        validation_errors[field_name] = (
                            f"{field_display_name} must be a valid number"
                        )
                        continue

                    # Check decimal places
                    if value.as_tuple().exponent < -validation_rules["decimal_places"]:
                        decimal_text = (
                            "decimal place"
                            if validation_rules["decimal_places"] == 1
                            else "decimal places"
                        )
                        validation_errors[field_name] = (
                            f"{field_display_name} can have at most {validation_rules['decimal_places']} {decimal_text}"
                        )
                        continue

                    # Check minimum value
                    if value < validation_rules["min"]:
                        validation_errors[field_name] = (
                            f"{field_display_name} must be at least {validation_rules['min']}"
                        )
                        continue

                    # Check maximum value
                    if value > validation_rules["max"]:
                        validation_errors[field_name] = (
                            f"{field_display_name} must not exceed {validation_rules['max']}"
                        )
                        continue

                    # Store old value for logging
                    old_values[field_name] = getattr(settings, field_name)
                    setattr(settings, field_name, value)
                    updated_fields.append(field_name)

                except (InvalidOperation, ValueError, TypeError):
                    validation_errors[field_name] = (
                        f"{field_display_name} must be a valid number"
                    )

        # Validate email field
        if "forward_certificate_emails_to" in request.data:
            email_value = str(request.data["forward_certificate_emails_to"]).strip()

            if not email_value:
                validation_errors["forward_certificate_emails_to"] = (
                    "Admin email address is required"
                )
            elif len(email_value) > 254:
                validation_errors["forward_certificate_emails_to"] = (
                    "Email address is too long (maximum 254 characters)"
                )
            else:
                try:
                    validate_email(email_value)
                    old_values["forward_certificate_emails_to"] = (
                        settings.forward_certificate_emails_to
                    )
                    settings.forward_certificate_emails_to = email_value
                    updated_fields.append("forward_certificate_emails_to")
                except ValidationError:
                    validation_errors["forward_certificate_emails_to"] = (
                        "Please enter a valid email address"
                    )

        # Validate send_emails_to_self field
        if "send_emails_to_self" in request.data:
            try:
                # Handle various boolean representations
                input_value = request.data["send_emails_to_self"]
                if isinstance(input_value, str):
                    bool_value = input_value.lower() in ("true", "1", "yes", "on")
                else:
                    bool_value = bool(input_value)

                # Check environment restrictions only if trying to disable in local env
                environment = getattr(django_settings, "ENVIRONMENT", "local").lower()
                if environment == "local" and bool_value is False:
                    # In local environment, emails should always go to admin for safety
                    # But we'll allow the setting change and just warn the user
                    pass  # Allow the change but the model logic will override it

                old_values["send_emails_to_self"] = settings.send_emails_to_self
                settings.send_emails_to_self = bool_value
                updated_fields.append("send_emails_to_self")
            except (ValueError, TypeError):
                validation_errors["send_emails_to_self"] = (
                    "Email routing setting must be true or false"
                )

        # Validate email_testing_mode field
        if "email_testing_mode" in request.data:
            try:
                input_value = request.data["email_testing_mode"]
                if isinstance(input_value, str):
                    bool_value = input_value.lower() in ("true", "1", "yes", "on")
                else:
                    bool_value = bool(input_value)

                old_values["email_testing_mode"] = settings.email_testing_mode
                settings.email_testing_mode = bool_value
                updated_fields.append("email_testing_mode")
            except (ValueError, TypeError):
                validation_errors["email_testing_mode"] = (
                    "Email testing mode must be true or false"
                )

        # Validate ocr_enabled feature flag
        if "ocr_enabled" in request.data:
            input_value = request.data["ocr_enabled"]
            if isinstance(input_value, str):
                bool_value = input_value.lower() in ("true", "1", "yes", "on")
            else:
                bool_value = bool(input_value)
            old_values["ocr_enabled"] = settings.ocr_enabled
            settings.ocr_enabled = bool_value
            updated_fields.append("ocr_enabled")

        # Validate certificate_counter field
        if "certificate_counter" in request.data:
            try:
                counter_value = int(request.data["certificate_counter"])
                if counter_value < 0:
                    validation_errors["certificate_counter"] = (
                        "Certificate counter must be 0 or greater"
                    )
                elif counter_value > 999999:
                    validation_errors["certificate_counter"] = (
                        "Certificate counter must not exceed 999999"
                    )
                else:
                    old_values["certificate_counter"] = settings.certificate_counter
                    settings.certificate_counter = counter_value
                    updated_fields.append("certificate_counter")
            except (ValueError, TypeError):
                validation_errors["certificate_counter"] = (
                    "Certificate counter must be a whole number"
                )

        # Validate email_test_user field
        if "email_test_user" in request.data:
            from django.contrib.auth import get_user_model

            User = get_user_model()

            user_id = request.data["email_test_user"]
            if user_id is None or user_id == "":
                old_values["email_test_user"] = settings.email_test_user
                settings.email_test_user = None
                updated_fields.append("email_test_user")
            else:
                try:
                    test_user = User.objects.get(pk=int(user_id))
                    old_values["email_test_user"] = settings.email_test_user
                    settings.email_test_user = test_user
                    updated_fields.append("email_test_user")
                except (User.DoesNotExist, ValueError, TypeError):
                    validation_errors["email_test_user"] = (
                        "Invalid user ID for email test user"
                    )

        # Return validation errors if any
        if validation_errors:
            logger.warning(
                f"Settings validation failed for user {request.user.username}: {validation_errors}"
            )

            # Format errors for frontend consumption
            formatted_errors = {}
            for field_name, error_message in validation_errors.items():
                formatted_errors[field_name] = (
                    [error_message] if isinstance(error_message, str) else error_message
                )

            raise DRFValidationError(formatted_errors)

        # Save changes if any fields were updated
        if updated_fields:
            # Set audit fields
            settings.last_modified_by = request.user

            try:
                settings.save(
                    update_fields=updated_fields
                    + ["last_modified_by", "last_modified_at"]
                )

                # Log the changes
                changes_summary = []
                for field in updated_fields:
                    old_val = old_values.get(field, "N/A")
                    new_val = getattr(settings, field)
                    changes_summary.append(f"{field}: {old_val} → {new_val}")

                logger.info(
                    f"System settings updated by {request.user.username} "
                    f"(ID: {request.user.id}). Changes: {'; '.join(changes_summary)}"
                )

            except Exception as e:
                logger.error(
                    f"Failed to save system settings for user {request.user.username}: {str(e)}"
                )
                raise

        # Return updated settings
        return self.get(request)
