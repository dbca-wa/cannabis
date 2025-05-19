from medias.models import UserAvatar
from users.models import DBCAStaffProfile, PoliceStaffProfile, User
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ["password"]


class TinyUserSerializer(serializers.ModelSerializer):

    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "role",
        )

    def get_role(self, obj):
        try:
            return obj.dbca_staff_profile.role
        except DBCAStaffProfile.DoesNotExist:
            pass  # User is not a DBCA staff

        try:
            return obj.police_staff_profile.role
        except PoliceStaffProfile.DoesNotExist:
            pass  # User is not a police staff

        return DBCAStaffProfile.RoleChoices.NONE  # User has no specific staff role


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("email", "username", "password")

    def validate_email(self, value):
        """
        Check if email already exists
        """
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered")
        return value

    def validate_username(self, value):
        """
        Check if username already exists
        """
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value


class UserAvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAvatar
        fields = ("id", "image")
