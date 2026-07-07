from rest_framework import serializers

from ..models import BotanicalAssessment, DrugBag


class BotanicalAssessmentSerializer(serializers.ModelSerializer):
    """Serializer for botanical assessments"""

    determination_display = serializers.CharField(
        source="get_determination_display", read_only=True
    )
    is_cannabis = serializers.ReadOnlyField()

    class Meta:
        model = BotanicalAssessment
        fields = [
            "id",
            "determination",
            "determination_display",
            "is_cannabis",
            "assessment_date",
            "botanist_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DrugBagSerializer(serializers.ModelSerializer):
    """Complete serializer for drug bags.

    Seal tag numbers are not required to be unique across forms or cases, so no
    cross-case uniqueness is enforced here.
    """

    content_type_display = serializers.CharField(
        source="get_content_type_display", read_only=True
    )
    assessment = BotanicalAssessmentSerializer(read_only=True)
    security_movement_envelope = serializers.ReadOnlyField()

    class Meta:
        model = DrugBag
        fields = [
            "id",
            "content_type",
            "content_type_display",
            "seal_tag_numbers",
            "new_seal_tag_numbers",
            "property_reference",
            "gross_weight",
            "net_weight",
            "security_movement_envelope",
            "assessment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "security_movement_envelope",
        ]


class DrugBagCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating drug bags against a Priority 3 form."""

    class Meta:
        model = DrugBag
        fields = [
            "id",
            "form",
            "content_type",
            "seal_tag_numbers",
            "new_seal_tag_numbers",
            "property_reference",
            "gross_weight",
            "net_weight",
        ]
        read_only_fields = ["id"]


class DrugBagBatchItemSerializer(serializers.Serializer):
    """Serializer for a single item in a batch bag creation request."""

    seal_tag_numbers = serializers.CharField(max_length=100)
    new_seal_tag_numbers = serializers.CharField(
        max_length=100, required=False, allow_blank=True, allow_null=True
    )
    content_type = serializers.ChoiceField(choices=DrugBag.ContentType.choices)
    determination = serializers.ChoiceField(
        choices=BotanicalAssessment.DeterminationChoices.choices, required=False
    )
    assessment_date = serializers.DateField(required=False, allow_null=True)


class DrugBagBatchCreateSerializer(serializers.Serializer):
    """Serializer for batch creation of multiple drug bags."""

    bags = DrugBagBatchItemSerializer(many=True, min_length=1, max_length=50)

    def validate(self, attrs):
        """Basic validation — seal tags are free-text fields with no uniqueness
        constraint. They may repeat across forms, cases, and even within a
        single batch (e.g. original and new seal can be identical).
        """
        return attrs
