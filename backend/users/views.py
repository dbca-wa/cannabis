from math import ceil
from django.conf import settings
from django.db.models import Q
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_204_NO_CONTENT,
    HTTP_202_ACCEPTED,
    HTTP_400_BAD_REQUEST,
    HTTP_201_CREATED,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
    HTTP_500_INTERNAL_SERVER_ERROR,
)

from rest_framework.exceptions import NotFound, ParseError
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    AllowAny,
    IsAdminUser,
)

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction

from users.models import User
from users.serializers import (
    TinyUserSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


# Only allow registration in development
class Register(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.DEBUG:
            return Response(
                {"error": "Registration not available in production"},
                status=HTTP_400_BAD_REQUEST,
            )

        settings.LOGGER.info(msg="New user registration attempt")
        serializer = UserRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    first_name = serializer.validated_data.get(
                        "first_name", ""
                    ).capitalize()
                    last_name = serializer.validated_data.get(
                        "last_name", ""
                    ).capitalize()

                    user = User.objects.create_user(
                        username=serializer.validated_data["username"],
                        email=serializer.validated_data["email"],
                        password=serializer.validated_data["password"],
                        first_name=first_name,
                        last_name=last_name,
                    )

                    return Response(
                        TinyUserSerializer(user).data, status=HTTP_201_CREATED
                    )
            except Exception as e:
                settings.LOGGER.error(msg=f"Registration error: {e}")
                raise ParseError(detail=str(e))
        else:
            settings.LOGGER.error(msg=f"Invalid registration data: {serializer.errors}")
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class Users(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings.LOGGER.info(msg=f"{request.user} is viewing/filtering users")

        try:
            page = int(request.GET.get("page", 1))
        except ValueError:
            page = 1

        page_size = settings.PAGE_SIZE
        start = (page - 1) * page_size
        end = start + page_size

        search_term = request.GET.get("searchTerm", "").strip()
        users = User.objects.all()

        if search_term:
            search_parts = search_term.split(" ", 1)
            if len(search_parts) == 2:
                first_name, last_name = search_parts
                users = users.filter(
                    Q(first_name__icontains=first_name)
                    & Q(last_name__icontains=last_name)
                    | Q(email__icontains=search_term)
                    | Q(username__icontains=search_term)
                )
            else:
                users = users.filter(
                    Q(first_name__icontains=search_term)
                    | Q(last_name__icontains=search_term)
                    | Q(email__icontains=search_term)
                    | Q(username__icontains=search_term)
                )

        total_users = users.count()
        total_pages = ceil(total_users / page_size)
        users = users.order_by("username")[start:end]

        serialized_users = TinyUserSerializer(
            users, many=True, context={"request": request}
        ).data

        response_data = {
            "users": serialized_users,
            "total_results": total_users,
            "total_pages": total_pages,
        }

        return Response(response_data, status=HTTP_200_OK)

    def post(self, req):
        settings.LOGGER.info(msg=f"{req.user} is creating user")
        ser = UserSerializer(data=req.data)

        if ser.is_valid():
            try:
                with transaction.atomic():
                    first_name = req.data.get("firstName", "").capitalize()
                    last_name = req.data.get("lastName", "").capitalize()

                    new_user = ser.save(
                        first_name=first_name,
                        last_name=last_name,
                        is_staff=False,
                    )

                    new_user.set_password(settings.EXTERNAL_PASS)
                    new_user.save()

                    return Response(
                        TinyUserSerializer(new_user).data,
                        status=HTTP_201_CREATED,
                    )
            except Exception as e:
                settings.LOGGER.error(msg=f"{e}")
                raise ParseError(e)
        else:
            settings.LOGGER.error(msg=f"Invalid Serializer: {ser.errors}")
            return Response(ser.errors, status=HTTP_400_BAD_REQUEST)


class UserDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, id):
        try:
            obj = User.objects.get(id=id)
        except User.DoesNotExist:
            raise NotFound
        return obj

    def get(self, req, id):
        user = self.get_object(id)
        ser = UserSerializer(user, context={"request": req})
        return Response(ser.data, status=HTTP_200_OK)

    def delete(self, req, id):
        user = self.get_object(id)
        settings.LOGGER.info(msg=f"{req.user} is deleting user: {user}")
        user.delete()
        return Response(status=HTTP_204_NO_CONTENT)

    def put(self, req, id):
        user = self.get_object(id)
        settings.LOGGER.info(msg=f"{req.user} is updating user: {user}")

        ser = UserSerializer(user, data=req.data, partial=True)
        if ser.is_valid():
            u_user = ser.save()
            return Response(
                TinyUserSerializer(u_user).data,
                status=HTTP_202_ACCEPTED,
            )
        else:
            settings.LOGGER.error(msg=f"{ser.errors}")
            return Response(ser.errors, status=HTTP_400_BAD_REQUEST)


class WhoAmI(APIView):
    permission_classes = [IsAuthenticated]

    @method_decorator(never_cache)
    def get(self, req):
        user = req.user

        # Base user data
        user_data = TinyUserSerializer(user).data

        # Add profile information from middleware
        user_data.update(
            {
                "user_type": getattr(req, "user_type", "unknown"),
                "user_role": getattr(req, "user_role", None),
            }
        )

        # Add profile-specific data based on what profile exists
        if hasattr(user, "dbca_staff_profile"):
            profile = user.dbca_staff_profile
            user_data.update(
                {
                    "profile": {
                        "type": "dbca_staff",
                        "role": profile.role,
                        "role_display": profile.get_role_display(),
                        "it_asset_id": profile.it_asset_id,
                        "employee_id": profile.employee_id,
                    }
                }
            )
        elif hasattr(user, "police_staff_profile"):
            profile = user.police_staff_profile
            user_data.update(
                {
                    "profile": {
                        "type": "police_staff",
                        "role": profile.role,
                        "role_display": profile.get_role_display(),
                        "police_id": profile.police_id,
                        "station_membership": (
                            profile.station_membership.name
                            if profile.station_membership
                            else None
                        ),
                    }
                }
            )

        return Response(user_data, status=HTTP_200_OK)

    def put(self, req):
        user = req.user
        settings.LOGGER.info(msg=f"{req.user} is updating their details")

        ser = TinyUserSerializer(user, data=req.data, partial=True)
        if ser.is_valid():
            updated = ser.save()
            return Response(
                TinyUserSerializer(updated).data,
                status=HTTP_202_ACCEPTED,
            )
        else:
            settings.LOGGER.error(msg=f"{ser.errors}")
            return Response(ser.errors, status=HTTP_400_BAD_REQUEST)


class UserSearch(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Search for users by email or username"""
        settings.LOGGER.info(msg=f"{request.user} is searching for users")

        search_term = request.GET.get("q", "").strip()
        if not search_term:
            return Response([], status=HTTP_200_OK)

        users = User.objects.filter(
            Q(email__icontains=search_term) | Q(username__icontains=search_term)
        ).exclude(id=request.user.id)[:10]

        serializer = TinyUserSerializer(users, many=True)
        return Response(serializer.data, status=HTTP_200_OK)


from django.views.decorators.csrf import csrf_exempt


class Login(APIView):
    permission_classes = [AllowAny]

    @method_decorator(csrf_exempt)
    def post(self, req):
        # In production, DBCA middleware handles authentication
        # This is primarily for development
        if not settings.DEBUG:
            return Response(
                {"error": "Authentication handled by DBCA middleware in production"},
                status=HTTP_400_BAD_REQUEST,
            )

        username = req.data.get("email")
        password = req.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and Password must both be provided!"},
                status=HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username, password=password)
        if user:
            login(req, user)
            settings.LOGGER.info(msg=f"User {user.username} logged in successfully")
            return Response({"ok": "Welcome"}, status=HTTP_200_OK)
        else:
            settings.LOGGER.warning(msg=f"Failed login attempt for: {username}")
            return Response(
                {"error": "Incorrect credentials"}, status=HTTP_401_UNAUTHORIZED
            )


class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, req):
        settings.LOGGER.info(msg=f"{req.user} is logging out...")

        # In development, simple logout
        if settings.DEBUG:
            logout(req)
            return Response({"ok": "Logged out successfully"}, status=HTTP_200_OK)

        # In production, check for DBCA logout URL from headers
        logout_url = req.META.get("HTTP_X_LOGOUT_URL")
        if logout_url:
            logout(req)
            return Response({"logoutUrl": logout_url}, status=HTTP_200_OK)
        else:
            # Fallback logout
            logout(req)
            return Response({"ok": "Logged out successfully"}, status=HTTP_200_OK)


# CSRF Token endpoint
class CSRFToken(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(
            {
                "csrf_token": get_token(request),
                "authenticated": request.user.is_authenticated,
            }
        )
