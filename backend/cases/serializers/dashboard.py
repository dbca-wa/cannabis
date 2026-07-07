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

    derived_status = serializers.SerializerMethodField()
    derived_status_display = serializers.SerializerMethodField()
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
            "derived_status",
            "derived_status_display",
            "received",
            "approved_botanist_name",
            "finance_officer_name",
            "bags_count",
        ]
        read_only_fields = ["id", "case_number", "received"]

    def get_derived_status(self, obj):
        return str(obj.derived_status)

    def get_derived_status_display(self, obj):
        try:
            return Case.PhaseChoices(obj.derived_status).label
        except ValueError:
            return str(obj.derived_status)

    def get_bags_count(self, obj):
        annotated = getattr(obj, "bags_count", None)
        if annotated is not None:
            return annotated
        return obj.bag_count
