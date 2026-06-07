from rest_framework import serializers

from ..models import CaseDraft


class CaseDraftSerializer(serializers.ModelSerializer):
    """Serialiser for case drafts (wizard state persistence)."""

    class Meta:
        model = CaseDraft
        fields = ["id", "data", "current_step", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
