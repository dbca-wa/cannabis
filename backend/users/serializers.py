from users.models import User, UserPreferences
from rest_framework import serializers
from django.db import transaction
from datetime import datetime


class UserPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for user preferences"""

    class Meta:
        model = UserPreferences
        exclude = ["user", "created_at", "updated_at"]

    def to_representation(self, instance):
        """Add computed fields for frontend"""
        data = super().to_representation(instance)

        # Add helper methods as computed fields
        data["is_dark_mode"] = instance.is_dark_mode()
        data["css_theme_class"] = instance.get_css_theme_class()
        data["display_preferences"] = instance.get_display_preferences()
        data["notification_settings"] = instance.get_notification_settings()

        return data


class UserJWTObjectSerializer(serializers.ModelSerializer):
    """
    Comprehensive user serializer for JWT authentication response
    Includes user data + preferences for MobX stores
    """

    # Include preferences as nested object
    preferences = UserPreferencesSerializer(read_only=True)

    # Add computed/display fields
    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()

    # Authentication status (always true for this serializer)
    is_authenticated = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            # Core user fields
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "initials",
            # Role information
            "role",
            "role_display",
            # IT Assets integration
            "it_asset_id",
            "employee_id",
            # Django user fields
            "is_staff",
            "is_active",
            "is_superuser",
            "date_joined",
            "last_login",
            # Authentication status
            "is_authenticated",
            # Nested preferences
            "preferences",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "last_login",
            "is_authenticated",
            "full_name",
            "initials",
            "role_display",
        ]

    def get_full_name(self, obj):
        """Get user's full name"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        elif obj.first_name:
            return obj.first_name
        elif obj.last_name:
            return obj.last_name
        else:
            return obj.email.split("@")[0]  # Fallback to email username

    def get_initials(self, obj):
        """Get user initials for avatars"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name[0]}{obj.last_name[0]}".upper()
        elif obj.first_name:
            return obj.first_name[0].upper()
        elif obj.last_name:
            return obj.last_name[0].upper()
        else:
            return obj.email[0].upper()

    def get_role_display(self, obj):
        """Get human-readable role name"""
        return obj.get_role_display()

    def get_is_authenticated(self, obj):
        """Always true for this serializer (user is authenticated if we're serializing them)"""
        return True


class UserJWTTokenSerializer(serializers.Serializer):
    """
    Complete JWT response serializer including tokens and user data
    This is what gets sent to the frontend on successful login
    """

    # JWT tokens
    access = serializers.CharField(help_text="JWT access token")
    refresh = serializers.CharField(help_text="JWT refresh token")

    # User object
    user = UserJWTObjectSerializer(help_text="Complete user object with preferences")

    # Optional metadata
    token_type = serializers.CharField(default="Bearer", help_text="Token type")
    expires_in = serializers.IntegerField(help_text="Access token expiry in seconds")

    class Meta:
        fields = ["access", "refresh", "user", "token_type", "expires_in"]


# Lightweight serializer for quick user info (for /whoami endpoint)
class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info without preferences (for quick responses)"""

    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    is_authenticated = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "initials",
            "role",
            "role_display",
            "is_authenticated",
        ]

    def get_full_name(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.email.split("@")[0]

    def get_initials(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name[0]}{obj.last_name[0]}".upper()
        return obj.email[0].upper()

    def get_role_display(self, obj):
        return obj.get_role_display()

    def get_is_authenticated(self, obj):
        return True


class UserTinySerializer(serializers.ModelSerializer):
    """
    Minimal user info for lists - perfect for user management tables
    """

    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "initials",
            "role",
            "role_display",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_full_name(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.email.split("@")[0]

    def get_initials(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name[0]}{obj.last_name[0]}".upper()
        return obj.email[0].upper()

    def get_role_display(self, obj):
        return obj.get_role_display()


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new users (admin only)
    """

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "email",
            "first_name",
            "last_name",
            "role",
            "password",
            "password_confirm",
            "is_staff",
            "is_active",
            "it_asset_id",
            "employee_id",
        ]

    def validate(self, attrs):
        """Validate password confirmation"""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        """Create user with hashed password"""
        validated_data.pop("password_confirm")  # Remove confirmation field
        password = validated_data.pop("password")

        user = User.objects.create_user(password=password, **validated_data)

        # Create default preferences
        user.get_preferences()

        return user
