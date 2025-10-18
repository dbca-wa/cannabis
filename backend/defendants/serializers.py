from rest_framework import serializers
from .models import Defendant


class DefendantSerializer(serializers.ModelSerializer):
    """Complete serializer for defendants"""

    pdf_name = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    cases_count = serializers.SerializerMethodField()

    class Meta:
        model = Defendant
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "pdf_name",
            "cases_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "full_name",
            "pdf_name",
            "cases_count",
        ]

    def get_cases_count(self, obj):
        """Get number of cases (submissions) this defendant is involved in"""
        if hasattr(obj, "cases_count"):
            return obj.cases_count
        return obj.submissions.count()

    def validate_last_name(self, value):
        """Ensure last name is provided"""
        if not value or not value.strip():
            raise serializers.ValidationError("Last name is required.")
        return value.strip()

    def validate_first_name(self, value):
        """Clean first name if provided"""
        if value:
            return value.strip()
        return value


class DefendantTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for defendant references"""

    full_name = serializers.ReadOnlyField()
    cases_count = serializers.SerializerMethodField()

    class Meta:
        model = Defendant
        fields = ["id", "first_name", "last_name", "full_name", "cases_count"]

    def get_cases_count(self, obj):
        """Get number of cases (submissions) this defendant is involved in"""
        if hasattr(obj, "cases_count"):
            return obj.cases_count
        return obj.submissions.count()
