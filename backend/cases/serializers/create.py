from rest_framework import serializers

from ..models import Case


class CaseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating cases"""

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "received",
            "security_movement_envelope",
            "requesting_officer",
            "submitting_officer",
            "defendants",
        ]
        read_only_fields = ["id"]

    def validate(self, data):
        """
        Validate case data.
        Required fields must be present and not blank.
        """
        required_fields = ["case_number", "security_movement_envelope"]
        for field in required_fields:
            value = data.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                raise serializers.ValidationError({field: "This field is required."})

        return data

    def validate_case_number(self, value):
        """Ensure case numbers are unique (only for non-empty values)"""
        # Allow empty case numbers for drafts
        if value and value.strip():
            if Case.objects.filter(case_number=value).exists():
                raise serializers.ValidationError("Case number must be unique.")
        return value

    def validate_received(self, value):
        """
        Handle date-only input by defaulting time to 9:00 AM.
        Accepts both date strings (YYYY-MM-DD) and datetime strings.
        """
        from datetime import datetime, time

        # If value is already a datetime object with time, use it as-is
        if isinstance(value, datetime) and value.time() != time(0, 0):
            return value

        # If it's a date object or datetime at midnight, set time to 9:00 AM
        if isinstance(value, datetime):
            return value.replace(hour=9, minute=0, second=0, microsecond=0)

        return value
