"""User serializers for authentication, profiles, and management."""

from rest_framework import serializers

from users.models import User

from .preferences_serializer import UserPreferencesSerializer


class UserJWTObjectSerializer(serializers.ModelSerializer):
    """
    Comprehensive user serializer for JWT authentication response.
    Includes user data + preferences for MobX stores.
    """

    preferences = UserPreferencesSerializer(read_only=True)
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
            "it_asset_id",
            "employee_id",
            "is_staff",
            "is_active",
            "is_superuser",
            "date_joined",
            "last_login",
            "is_authenticated",
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
            return obj.email.split("@")[0]

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
    Complete JWT response serializer including tokens and user data.
    This is what gets sent to the frontend on successful login.
    """

    access = serializers.CharField(help_text="JWT access token")
    refresh = serializers.CharField(help_text="JWT refresh token")
    user = UserJWTObjectSerializer(help_text="Complete user object with preferences")
    token_type = serializers.CharField(default="Bearer", help_text="Token type")
    expires_in = serializers.IntegerField(help_text="Access token expiry in seconds")

    class Meta:
        fields = ["access", "refresh", "user", "token_type", "expires_in"]


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
            "is_staff",
            "is_superuser",
            "is_active",
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
    """Minimal user info for lists - perfect for user management tables"""

    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    has_signature = serializers.SerializerMethodField()
    cases_count = serializers.IntegerField(read_only=True, default=0)

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
            "is_superuser",
            "date_joined",
            "last_login",
            "has_signature",
            "cases_count",
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

    def get_has_signature(self, obj):
        """Return whether a botanist user has a signature on file."""
        if obj.role != "botanist":
            return None
        if hasattr(obj, "_has_signature"):
            return obj._has_signature
        from signatures.models import Signature

        return Signature.objects.filter(user=obj).exists()


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users (admin only)"""

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
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        user = User.objects.create_user(password=password, **validated_data)

        # Create default preferences (get_preferences is a @property)
        _ = user.get_preferences

        return user
