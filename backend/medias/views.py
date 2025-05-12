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

from rest_framework.exceptions import NotFound, ParseError, PermissionDenied
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    AllowAny,
    IsAdminUser,
)

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction

from .models import UserAvatar
from .serializers import (
    UserAvatarSerializer,
)


class UserAvatar(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get the avatar for the current user"""
        settings.LOGGER.info(msg=f"{request.user} is viewing their avatar")

        try:
            avatar = UserAvatar.objects.get(user=request.user, deleted_at__isnull=True)

            serializer = UserAvatarSerializer(avatar, context={"request": request})

            return Response(serializer.data, status=HTTP_200_OK)
        except UserAvatar.DoesNotExist:
            return Response({"detail": "No avatar found"}, status=HTTP_404_NOT_FOUND)

    def post(self, request):
        """Create or replace the avatar for the current user"""
        settings.LOGGER.info(msg=f"{request.user} is uploading a new avatar")

        serializer = UserAvatarSerializer(
            data=request.data, context={"request": request}
        )

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    # Delete existing avatar if it exists
                    UserAvatar.objects.filter(user=request.user).delete()

                    # Create new avatar
                    avatar = serializer.save()
                    return Response(
                        UserAvatarSerializer(avatar, context={"request": request}).data,
                        status=HTTP_201_CREATED,
                    )
            except Exception as e:
                settings.LOGGER.error(msg=f"Error creating avatar: {e}")
                raise ParseError(detail=str(e))
        else:
            settings.LOGGER.error(msg=f"Invalid avatar data: {serializer.errors}")
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class UserAvatarDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, user):
        try:
            avatar = UserAvatar.objects.get(user=user, deleted_at__isnull=True)
            return avatar
        except UserAvatar.DoesNotExist:
            raise NotFound("Avatar not found")

    def get(self, request):
        try:
            avatar = self.get_object(request.user)
            serializer = UserAvatarSerializer(avatar, context={"request": request})
            return Response(serializer.data, status=HTTP_200_OK)
        except NotFound:
            return Response({"detail": "No avatar found"}, status=HTTP_404_NOT_FOUND)

    def delete(self, request):
        try:
            avatar = self.get_object(request.user)
            settings.LOGGER.info(msg=f"{request.user} is deleting their avatar")

            # Soft delete the avatar
            avatar.soft_delete()

            return Response(status=HTTP_204_NO_CONTENT)
        except NotFound:
            return Response({"detail": "No avatar found"}, status=HTTP_404_NOT_FOUND)

    def put(self, request):
        try:
            avatar = self.get_object(request.user)
            settings.LOGGER.info(msg=f"{request.user} is updating their avatar")

            serializer = UserAvatarSerializer(
                avatar, data=request.data, partial=True, context={"request": request}
            )

            if serializer.is_valid():
                try:
                    with transaction.atomic():
                        updated_avatar = serializer.save()
                        return Response(
                            UserAvatarSerializer(
                                updated_avatar, context={"request": request}
                            ).data,
                            status=HTTP_202_ACCEPTED,
                        )
                except Exception as e:
                    settings.LOGGER.error(msg=f"Error updating avatar: {e}")
                    raise ParseError(detail=str(e))
            else:
                settings.LOGGER.error(msg=f"Invalid avatar data: {serializer.errors}")
                return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        except NotFound:
            # If avatar doesn't exist, create a new one
            return self.post(request)
