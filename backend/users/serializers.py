from medias.models import UserAvatar
from users.models import User
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ["password"]


class TinyUserSerializer(serializers.ModelSerializer):
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


class ParticipantSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    role = serializers.CharField(default="editor")

    class Meta:
        model = User
        fields = ("id", "username", "email", "image", "role")

    def get_image(self, obj):
        # Get user's avatar or return empty string
        try:
            avatar = obj.avatar
            return self.context["request"].build_absolute_uri(avatar.image.url)
        except (AttributeError, UserAvatar.DoesNotExist):
            return ""
