from typing import Dict, Any
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""

    class Meta:
        model = User
        fields = ["id", "email", "username", "is_superuser", "is_staff"]
        read_only_fields = ["id", "is_superuser", "is_staff"]


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""

    email = serializers.EmailField()
    password = serializers.CharField(
        style={"input_type": "password"}, trim_whitespace=False
    )


class SignupSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""

    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = ["email", "username", "password", "password_confirm"]
        extra_kwargs = {"email": {"required": True}}

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that passwords match"""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords don't match"}
            )
        return attrs

    def validate_email(self, value: str) -> str:
        """Validate email is not already in use"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists")
        return value

    def create(self, validated_data: Dict[str, Any]) -> Any:
        """Create and return a new user"""
        # Remove password_confirm from validated data
        validated_data.pop("password_confirm", None)

        # Create user with email as the identifier
        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data.get(
                "username", ""
            ),  # Username might be optional now
            password=validated_data["password"],
        )

        return user


class TokenSerializer(serializers.Serializer):
    """Serializer for token refresh"""

    token = serializers.CharField(required=True)


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for token response"""

    token = serializers.CharField()
    user = UserSerializer()
    message = serializers.CharField()
