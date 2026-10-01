from rest_framework import serializers

from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation
from users.models import User

from ..models import Case


class CaseUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating cases — accepts the editable base-data fields
    and returns the full case data for cache updates.

    The workflow phase lives on each Priority 3 form and is advanced by the
    workflow service, so it is not editable through the case here.
    """

    # Resolve related entities against every row (see CaseCreateSerializer): in
    # practice mode a user may still attach a real officer/station/defendant/
    # botanist, so validation must look beyond the mode-scoped default manager.
    requesting_officer = serializers.PrimaryKeyRelatedField(
        queryset=PoliceOfficer.all_objects.all(), required=False, allow_null=True
    )
    submitting_officer = serializers.PrimaryKeyRelatedField(
        queryset=PoliceOfficer.all_objects.all(), required=False, allow_null=True
    )
    station = serializers.PrimaryKeyRelatedField(
        queryset=PoliceStation.all_objects.all(), required=False, allow_null=True
    )
    approved_botanist = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    finance_officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    defendants = serializers.PrimaryKeyRelatedField(
        queryset=Defendant.all_objects.all(), many=True, required=False
    )

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "received",
            "internal_comments",
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
            "station",
            "defendants",
        ]
        read_only_fields = ["id"]
