from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from ..models import Notification
from ..serializers import (
    NotificationMarkReadSerializer,
    NotificationSerializer,
)

# ============================================================================
# region NOTIFICATION VIEWS
# ============================================================================


class NotificationListView(ListAPIView):
    """
    GET: List notifications for current user with filtering
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.for_user(self.request.user).select_related(
            "actor"
        )

        # Filter by read status
        is_read = self.request.query_params.get("is_read")
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == "true")

        # Filter by notification type
        notification_type = self.request.query_params.get("type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        # Filter by priority
        priority = self.request.query_params.get("priority")
        if priority:
            queryset = queryset.filter(priority=priority)

        # Filter out expired notifications unless explicitly requested
        include_expired = self.request.query_params.get("include_expired", "false")
        if include_expired.lower() != "true":
            from django.utils import timezone

            queryset = queryset.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
            )

        return queryset.order_by("-created_at")


class NotificationDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Get notification details
    PATCH: Update notification (mark as read/unread)
    DELETE: Delete notification
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.for_user(self.request.user)

    def perform_update(self, serializer):
        # Auto-set read_at when marking as read
        if serializer.validated_data.get("is_read") and not serializer.instance.is_read:
            from django.utils import timezone

            serializer.save(read_at=timezone.now())
        elif not serializer.validated_data.get("is_read", True):
            serializer.save(read_at=None)
        else:
            serializer.save()


class NotificationMarkReadView(APIView):
    """
    POST: Mark notifications as read/unread (bulk operation)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        is_read = serializer.validated_data["is_read"]
        notification_ids = serializer.validated_data.get("notification_ids")

        # Get base queryset for current user
        queryset = Notification.objects.for_user(request.user)

        # Filter by specific IDs if provided, otherwise use all unread
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        elif is_read:
            # If marking as read without specific IDs, mark all unread
            queryset = queryset.unread()
        else:
            # If marking as unread without specific IDs, mark all read
            queryset = queryset.filter(is_read=True)

        # Update notifications
        if is_read:
            from django.utils import timezone

            updated_count = queryset.update(is_read=True, read_at=timezone.now())
        else:
            updated_count = queryset.update(is_read=False, read_at=None)

        action = "marked as read" if is_read else "marked as unread"
        settings.LOGGER.info(
            f"User {request.user} {action} {updated_count} notifications"
        )

        return Response(
            {
                "message": f"{updated_count} notifications {action}",
                "updated_count": updated_count,
            },
            status=HTTP_200_OK,
        )


class NotificationStatsView(APIView):
    """
    GET: Get notification statistics for current user
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_notifications = Notification.objects.for_user(request.user)

        stats = {
            "total": user_notifications.count(),
            "unread": user_notifications.filter(is_read=False).count(),
            "recent": user_notifications.filter(
                created_at__gte=timezone.now() - timezone.timedelta(days=7)
            ).count(),
            "by_priority": {
                priority[0]: user_notifications.filter(priority=priority[0]).count()
                for priority in Notification.PriorityLevels.choices
            },
            "by_type": {},
        }

        # Get counts by notification type
        type_counts = user_notifications.values("notification_type").annotate(
            count=Count("notification_type")
        )

        for type_count in type_counts:
            stats["by_type"][type_count["notification_type"]] = type_count["count"]

        return Response(stats, status=HTTP_200_OK)


# endregion
