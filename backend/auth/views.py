from typing import Any, Dict
from rest_framework.views import APIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError
from django.core.exceptions import ValidationError
import jwt
from .serializers import (
    LoginSerializer,
    SignupSerializer,
    TokenSerializer,
    UserSerializer,
)
from .utils import generate_token, get_user_from_token, is_token_about_to_expire

User = get_user_model()


class LoginView(APIView):
    """API endpoint for user login"""

    permission_classes: list = []  # No permissions required to login

    def post(self, request: Request) -> Response:
        """Handle user login"""
        print("Someone is trying to login with creds")
        serializer = LoginSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "message": "Could not parse request data",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email: str = serializer.validated_data["email"]
        password: str = serializer.validated_data["password"]

        # print(
        #     {
        #         email,
        #         password,
        #     }
        # )

        # Authenticate user
        user = authenticate(request, username=email, password=password)

        print(user)

        if not user:
            return Response(
                {"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        # Generate token
        token: str = generate_token(user.id)

        # Return success response with serialized user data
        user_serializer = UserSerializer(user)
        return Response(
            {
                "message": "Login successful",
                "token": token,
                "user": user_serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class SignupView(APIView):
    """API endpoint for user registration"""

    permission_classes: list = []  # No permissions required to signup

    def post(self, request: Request) -> Response:
        """Handle user registration"""
        serializer = SignupSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "message": "Could not parse request data",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Create user
            user = serializer.save()

            # Generate token
            token: str = generate_token(user.id)

            # Return success response with serialized user data
            user_serializer = UserSerializer(user)
            return Response(
                {
                    "message": "User created successfully",
                    "token": token,
                    "user": user_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except IntegrityError:
            return Response(
                {"message": "User already exists"}, status=status.HTTP_400_BAD_REQUEST
            )
        except ValidationError as e:
            return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"message": "Could not create user", "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class RefreshTokenView(APIView):
    """API endpoint for refreshing authentication tokens"""

    permission_classes: list = []  # No permissions required to refresh token

    def post(self, request: Request) -> Response:
        """Handle token refresh"""
        serializer = TokenSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "message": "Could not parse request data",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        token: str = serializer.validated_data["token"]

        try:
            # Verify the token is valid
            user = get_user_from_token(token)

            if not user:
                return Response(
                    {"message": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED
                )

            # Generate a new token
            new_token: str = generate_token(user.id)

            # Return success response with new token and user data
            user_serializer = UserSerializer(user)
            return Response(
                {
                    "message": "Token refreshed successfully",
                    "token": new_token,
                    "user": user_serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except jwt.PyJWTError as e:
            return Response({"message": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response(
                {"message": "Could not refresh token", "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class VerifyTokenView(APIView):
    """API endpoint for verifying token validity"""

    permission_classes: list = []  # No permissions required to verify token

    def post(self, request: Request) -> Response:
        """Handle token verification"""
        serializer = TokenSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "message": "Could not parse request data",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        token: str = serializer.validated_data["token"]

        try:
            # Verify the token is valid
            user = get_user_from_token(token)

            if not user:
                return Response(
                    {"valid": False, "message": "Invalid token"},
                    status=status.HTTP_200_OK,
                )

            # Check if token is about to expire
            about_to_expire = is_token_about_to_expire(token)

            return Response(
                {
                    "valid": True,
                    "about_to_expire": about_to_expire,
                    "user_id": user.id,
                    "message": "Token is valid",
                },
                status=status.HTTP_200_OK,
            )

        except jwt.PyJWTError:
            return Response(
                {"valid": False, "message": "Invalid or expired token"},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"message": "Could not verify token", "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
