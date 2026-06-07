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
    """Complete serializer for drug bags"""

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
    """Serializer for creating drug bags"""

    class Meta:
        model = DrugBag
        fields = [
            "submission",
            "content_type",
            "seal_tag_numbers",
            "new_seal_tag_numbers",
            "property_reference",
            "gross_weight",
            "net_weight",
        ]

    def validate_seal_tag_numbers(self, value):
        """Ensure seal tag numbers are unique within a submission"""
        submission = self.initial_data.get("submission")
        if (
            DrugBag.objects.filter(submission=submission, seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .exists()
        ):
            raise serializers.ValidationError(
                "Seal tag numbers must be unique within submission."
            )
        return value
