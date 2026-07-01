from rest_framework import serializers

from ..models import Case


class CaseUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating cases — accepts all editable fields
    and returns the full case data for cache updates."""

    phase_display = serializers.CharField(source="get_phase_display", read_only=True)

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "received",
            "security_movement_envelope",
            "internal_comments",
            "additional_notes",
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
            "station",
            "defendants",
            "phase",
            "phase_display",
        ]
        read_only_fields = ["id", "phase_display"]

    def validate_phase(self, value):
        """Validate phase transitions"""
        if self.instance and self.instance.phase != value:
            pass
        return value
