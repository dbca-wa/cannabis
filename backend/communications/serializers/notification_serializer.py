"""Notification serializers."""

from rest_framework import serializers

from communications.models import Notification

from .comment_serializer import CommentAuthorSerializer


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications"""

    actor_details = CommentAuthorSerializer(source="actor", read_only=True)
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )
    age = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "notification_type_display",
            "priority",
            "priority_display",
            "action_url",
            "is_read",
            "read_at",
            "actor_details",
            "age",
            "is_expired",
            "created_at",
            "expires_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "age",
            "is_expired",
            "actor_details",
            "notification_type_display",
            "priority_display",
        ]


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications (admin use)"""

    class Meta:
        model = Notification
        fields = [
            "recipient",
            "actor",
            "notification_type",
            "title",
            "message",
            "action_url",
            "priority",
            "expires_at",
        ]


class NotificationMarkReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read/unread"""

    is_read = serializers.BooleanField()
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="List of notification IDs to update. If not provided, updates all unread notifications.",
    )
