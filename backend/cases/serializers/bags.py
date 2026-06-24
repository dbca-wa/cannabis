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

    def validate_seal_tag_numbers(self, value):
        """Ensure seal tag numbers are globally unique across all cases on update."""
        existing = (
            DrugBag.objects.filter(seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing:
            raise serializers.ValidationError(
                f"Tag '{value}' already exists on case {existing.submission.case_number} (id: {existing.submission.pk})."
            )
        return value

    def validate_new_seal_tag_numbers(self, value):
        """Ensure new seal tag numbers are globally unique across all cases on update."""
        if not value:
            return value
        existing = (
            DrugBag.objects.filter(new_seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing:
            raise serializers.ValidationError(
                f"New tag '{value}' already exists on case {existing.submission.case_number} (id: {existing.submission.pk})."
            )
        existing_original = (
            DrugBag.objects.filter(seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing_original:
            raise serializers.ValidationError(
                f"New tag '{value}' conflicts with original tag on case {existing_original.submission.case_number} (id: {existing_original.submission.pk})."
            )
        return value


class DrugBagCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating drug bags"""

    class Meta:
        model = DrugBag
        fields = [
            "id",
            "submission",
            "content_type",
            "seal_tag_numbers",
            "new_seal_tag_numbers",
            "property_reference",
            "gross_weight",
            "net_weight",
        ]
        read_only_fields = ["id"]

    def validate_seal_tag_numbers(self, value):
        """Ensure seal tag numbers are globally unique across all cases."""
        existing = (
            DrugBag.objects.filter(seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing:
            raise serializers.ValidationError(
                f"Tag '{value}' already exists on case {existing.submission.case_number} (id: {existing.submission.pk})."
            )
        return value

    def validate_new_seal_tag_numbers(self, value):
        """Ensure new seal tag numbers are globally unique across all cases."""
        if not value:
            return value
        existing = (
            DrugBag.objects.filter(new_seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing:
            raise serializers.ValidationError(
                f"New tag '{value}' already exists on case {existing.submission.case_number} (id: {existing.submission.pk})."
            )
        # Also check if it conflicts with any existing original tag
        existing_original = (
            DrugBag.objects.filter(seal_tag_numbers=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .select_related("submission")
            .first()
        )
        if existing_original:
            raise serializers.ValidationError(
                f"New tag '{value}' conflicts with original tag on case {existing_original.submission.case_number} (id: {existing_original.submission.pk})."
            )
        return value


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
