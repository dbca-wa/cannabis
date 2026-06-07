from rest_framework import serializers

from ..models import Case


class CaseUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating cases (restricted fields)"""

    class Meta:
        model = Case
        fields = [
            "approved_botanist",
            "finance_officer",
            "internal_comments",
            "defendants",
            "phase",
        ]

    def validate_phase(self, value):
        """Validate phase transitions"""
        if self.instance and self.instance.phase != value:
            # TODO: custom phase transition logic here if needed
            pass
        return value
