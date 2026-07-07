from rest_framework import serializers

from ..models import Case


class CaseUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating cases — accepts the editable base-data fields
    and returns the full case data for cache updates.

    The workflow phase lives on each Priority 3 form and is advanced by the
    workflow service, so it is not editable through the case here.
    """

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
