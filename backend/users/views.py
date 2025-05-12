from math import ceil
from django.conf import settings
from django.db.models import Q

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


class Register(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        settings.LOGGER.info(msg="New user registration attempt")
        serializer = UserRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    # Normalize the data
                    first_name = serializer.validated_data.get("first_name", "")
                    last_name = serializer.validated_data.get("last_name", "")

                    if first_name:
                        first_name = first_name.capitalize()
                    if last_name:
                        last_name = last_name.capitalize()

                    # Create the user with a properly hashed password (handled by Django)
                    user = User.objects.create_user(
                        username=serializer.validated_data["username"],
                        email=serializer.validated_data["email"],
                        password=serializer.validated_data["password"],
                        first_name=first_name,
                        last_name=last_name,
                    )

                    # Return the user data without the password
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
    # permission_classes = [IsAuthenticated]
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        settings.LOGGER.info(msg=f"{request.user} is viewing/filtering users")

        # Pagination
        try:
            page = int(request.GET.get("page", 1))
        except ValueError:
            page = 1

        page_size = settings.PAGE_SIZE
        start = (page - 1) * page_size
        end = start + page_size

        # Query Parameters
        search_term = request.GET.get("searchTerm", "").strip()

        # Base query
        users = User.objects.all()

        # Apply the search filter
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

        # Count total before pagination (using a more efficient count query)
        total_users = users.count()
        total_pages = ceil(total_users / page_size)

        # Sort and paginate - creating an efficient query
        users = users.order_by("username")[start:end]

        # Serialize and respond
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
        ser = UserSerializer(
            data=req.data,
        )
        if ser.is_valid():
            try:
                # Ensures everything is rolled back if there is an error.
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
                    ser = TinyUserSerializer(new_user)
                    return Response(
                        ser.data,
                        status=HTTP_201_CREATED,
                    )
            except Exception as e:
                settings.LOGGER.error(msg=f"{e}")
                raise ParseError(e)
        else:
            settings.LOGGER.error(msg=f"Invalid Serializer: {ser.errors}")
            return Response(
                ser.errors,
                status=HTTP_400_BAD_REQUEST,
            )


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
        ser = UserSerializer(
            user,
            context={"request": req},
        )
        return Response(
            ser.data,
            status=HTTP_200_OK,
        )

    def delete(self, req, id):
        user = self.get_object(id)
        settings.LOGGER.info(msg=f"{req.user} is deleting user: {user}")
        user.delete()
        return Response(
            status=HTTP_204_NO_CONTENT,
        )

    def put(self, req, id):
        user = self.get_object(id)
        settings.LOGGER.info(msg=f"{req.user} is updating user: {user}")
        # Removed print statement that was exposing sensitive data
        ser = UserSerializer(
            user,
            data=req.data,
            partial=True,
        )
        if ser.is_valid():
            u_user = ser.save()
            return Response(
                TinyUserSerializer(u_user).data,
                status=HTTP_202_ACCEPTED,
            )
        else:
            settings.LOGGER.error(msg=f"{ser.errors}")
            return Response(
                ser.errors,
                status=HTTP_400_BAD_REQUEST,
            )


class WhoAmI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, req):
        user = req.user
        ser = TinyUserSerializer(user)
        return Response(
            ser.data,
            status=HTTP_200_OK,
        )

    def put(self, req):
        user = req.user
        settings.LOGGER.info(msg=f"{req.user} is updating their details")
        ser = TinyUserSerializer(
            user,
            data=req.data,
            partial=True,
        )
        if ser.is_valid():
            updated = ser.save()
            return Response(
                TinyUserSerializer(updated).data,
                status=HTTP_202_ACCEPTED,
            )
        else:
            settings.LOGGER.error(msg=f"{ser.errors}")
            return Response(
                ser.errors,
                status=HTTP_400_BAD_REQUEST,
            )


class UserSearch(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Search for users by email or username"""
        settings.LOGGER.info(msg=f"{request.user} is searching for users")

        search_term = request.GET.get("q", "").strip()

        if not search_term:
            return Response([], status=HTTP_200_OK)

        # Limit to 10 results for performance
        users = User.objects.filter(
            Q(email__icontains=search_term) | Q(username__icontains=search_term)
        ).exclude(id=request.user.id)[:10]

        serializer = TinyUserSerializer(users, many=True)

        return Response(serializer.data, status=HTTP_200_OK)
