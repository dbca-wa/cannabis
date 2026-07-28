"""Serializers for Section C note templates."""

from rest_framework import serializers

from ..models import SectionCTemplate


class SectionCTemplateSerializer(serializers.ModelSerializer):
    """Read serializer for Section C templates."""

    class Meta:
        model = SectionCTemplate
        fields = ("id", "name", "content", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class SectionCTemplateCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating Section C templates."""

    class Meta:
        model = SectionCTemplate
        fields = ("name", "content")

    def validate_name(self, value):
        """Ensure name is not blank after stripping."""
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Template name cannot be blank.")
        return stripped

    def validate_content(self, value):
        """Ensure content is not blank after stripping."""
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Template content cannot be blank.")
        return stripped
