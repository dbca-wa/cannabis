"""
User preferences views: profile management and dedicated preference endpoints.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from common.logging import describe_user

from ..serializers import UserJWTObjectSerializer

User = get_user_model()

# Preference fields worth an audit line when the user changes them, mapped to a
# readable name. These are the personal settings a user toggles themselves.
_LOGGED_PREFERENCE_FIELDS = {
    "theme": "theme",
    "guide_enabled": "reference guide",
}


def _log_preference_changes(user, preferences, incoming: dict) -> None:
    """Log one line per tracked preference the user actually changed.

    Compares the incoming values against what is already stored, so a PATCH that
    doesn't change anything stays silent. Only whitelisted fields are logged.
    """
    for field, label in _LOGGED_PREFERENCE_FIELDS.items():
        if field not in incoming:
            continue
        new_value = incoming[field]
        old_value = getattr(preferences, field, None)
        if new_value == old_value:
            continue
        # Booleans read better as turned on/off than "to True".
        if isinstance(new_value, bool):
            settings.LOGGER.info(
                f"{describe_user(user)} turned their {label} "
                f"{'on' if new_value else 'off'}"
            )
        else:
            settings.LOGGER.info(
                f"{describe_user(user)} changed their {label} to {new_value}"
            )


# ============================================================================
# region USER PROFILE & PREFERENCES
# ============================================================================


class UserProfileView(APIView):
    """Current user's complete profile with preferences - for profile pages"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get complete profile with preferences"""
        user = request.user
        user.get_preferences()  # Ensure preferences exist

        serializer = UserJWTObjectSerializer(user)
        return Response(serializer.data, status=HTTP_200_OK)

    def patch(self, request):
        """Update current user's profile and preferences"""
        user = request.user

        # Separate user fields from preference fields
        user_fields = ["given_names", "last_name"]
        user_data = {k: v for k, v in request.data.items() if k in user_fields}
        preference_data = request.data.get("preferences", {})

        # Update user fields
        if user_data:
            user_serializer = UserJWTObjectSerializer(
                user, data=user_data, partial=True
            )
            if user_serializer.is_valid():
                user_serializer.save()
            else:
                raise ValidationError(user_serializer.errors)

        # Update preferences
        if preference_data:
            preferences = user.get_preferences()
            from ..serializers import UserPreferencesSerializer

            pref_serializer = UserPreferencesSerializer(
                preferences, data=preference_data, partial=True
            )
            if pref_serializer.is_valid():
                _log_preference_changes(
                    user, preferences, pref_serializer.validated_data
                )
                pref_serializer.save()
            else:
                raise ValidationError(pref_serializer.errors)

        # Return updated profile
        updated_serializer = UserJWTObjectSerializer(user)
        return Response(updated_serializer.data, status=HTTP_200_OK)


class UserPreferencesView(APIView):
    """
    GET: Get current user's preferences
    PATCH: Update current user's preferences
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current user's preferences"""
        user = request.user
        preferences = user.get_preferences  # Property, not method

        from ..serializers import UserPreferencesSerializer

        serializer = UserPreferencesSerializer(preferences)
        return Response(serializer.data, status=HTTP_200_OK)

    def patch(self, request):
        """Update current user's preferences"""
        user = request.user
        preferences = user.get_preferences  # Property, not method

        from ..serializers import UserPreferencesSerializer

        serializer = UserPreferencesSerializer(
            preferences, data=request.data, partial=True
        )

        if serializer.is_valid():
            # Log tracked changes before saving, while the stored values still
            # reflect the previous state for comparison.
            _log_preference_changes(user, preferences, serializer.validated_data)
            serializer.save()
            return Response(serializer.data, status=HTTP_200_OK)
        else:
            raise ValidationError(serializer.errors)


# endregion
