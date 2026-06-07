"""Signature serializers."""

from rest_framework import serializers

from signatures.models import Signature, SignatureAuditLog


class SignatureSerializer(serializers.ModelSerializer):
    """Serialiser for the Signature model.

    Exposes signature metadata and an authenticated image URL.
    The raw image file field is excluded — clients fetch the image
    via the authenticated ``/api/v1/signatures/me/image`` endpoint.
    """

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Signature
        fields = [
            "id",
            "user",
            "content_type",
            "file_size",
            "width",
            "height",
            "file_hash",
            "image_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "content_type",
            "file_size",
            "width",
            "height",
            "file_hash",
            "image_url",
            "created_at",
            "updated_at",
        ]

    def get_image_url(self, obj):
        """Return the authenticated endpoint URL for the signature image."""
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri("/api/v1/signatures/me/image")
        return "/api/v1/signatures/me/image"


class SignatureAuditLogSerializer(serializers.ModelSerializer):
    """Serialiser for the SignatureAuditLog model.

    Includes a read-only ``actor_name`` derived from the actor's
    full name, falling back to their email address.
    """

    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SignatureAuditLog
        fields = [
            "id",
            "user",
            "actor",
            "actor_name",
            "action",
            "timestamp",
            "content_type",
            "file_size",
            "file_hash",
        ]
        read_only_fields = [
            "id",
            "user",
            "actor",
            "actor_name",
            "action",
            "timestamp",
            "content_type",
            "file_size",
            "file_hash",
        ]

    def get_actor_name(self, obj):
        """Return the actor's display name, or 'System' if no actor."""
        if obj.actor is not None:
            return obj.actor.full_name or obj.actor.email
        return "System"
