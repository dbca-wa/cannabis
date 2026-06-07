from django.contrib.auth import get_user_model
from rest_framework import serializers

from ..models import Case, CasePhaseHistory

User = get_user_model()


class _UserTinySerializer(serializers.ModelSerializer):
    """Lightweight user serializer used within dashboard serializers."""

    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "role"]


class CasePhaseHistorySerializer(serializers.ModelSerializer):
    """Serializer for case phase history audit trail"""

    from_phase_display = serializers.CharField(
        source="get_from_phase_display", read_only=True
    )
    to_phase_display = serializers.CharField(
        source="get_to_phase_display", read_only=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    user_details = _UserTinySerializer(source="user", read_only=True, allow_null=True)

    class Meta:
        model = CasePhaseHistory
        fields = [
            "id",
            "from_phase",
            "from_phase_display",
            "to_phase",
            "to_phase_display",
            "action",
            "action_display",
            "user",
            "user_details",
            "reason",
            "timestamp",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "from_phase",
            "to_phase",
            "action",
            "user",
            "timestamp",
            "created_at",
        ]


class PendingAttentionSerializer(serializers.ModelSerializer):
    """Read-only serializer for the pending attention dashboard endpoint."""

    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    approved_botanist_name = serializers.CharField(
        source="approved_botanist.full_name", read_only=True
    )
    finance_officer_name = serializers.CharField(
        source="finance_officer.full_name", read_only=True
    )
    bags_count = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "phase",
            "phase_display",
            "received",
            "approved_botanist_name",
            "finance_officer_name",
            "bags_count",
        ]
        read_only_fields = fields

    def get_bags_count(self, obj):
        return getattr(obj, "bags_count", 0)
