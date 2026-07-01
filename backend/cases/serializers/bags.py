from django.db.models import Q
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

    def validate(self, attrs):
        """Reject duplicate or conflicting tag numbers, returning per-bag,
        per-field errors aligned by index so the client can highlight the exact
        offending fields.

        Every non-blank tag value (original or new) shares one unique namespace:
        it must be unique within the batch and must not already exist on any case
        (as either an original or a new tag). A new tag must also differ from its
        own original.
        """
        bags = attrs["bags"]
        errors = [{} for _ in bags]

        def add_error(index, field, message):
            errors[index].setdefault(field, []).append(message)

        # Map each claimed tag value to the (index, field) positions using it.
        positions = {}

        def claim(index, field, value):
            value = (value or "").strip()
            if value:
                positions.setdefault(value, []).append((index, field))

        for index, bag in enumerate(bags):
            original = (bag.get("seal_tag_numbers") or "").strip()
            new_tag = (bag.get("new_seal_tag_numbers") or "").strip()
            claim(index, "seal_tag_numbers", original)
            # A bag may legitimately carry the same value for its original and
            # new tag — the Priority 3 form sometimes repeats it when a bag was
            # not re-sealed. Treat that as a single claim for this entry rather
            # than a duplicate. The new tag is only claimed separately when it
            # differs, so reusing another bag's tag is still caught below.
            if new_tag and new_tag != original:
                claim(index, "new_seal_tag_numbers", new_tag)

        # Duplicates within the batch (a value claimed by more than one field).
        for value, occurrences in positions.items():
            if len(occurrences) > 1:
                for index, field in occurrences:
                    add_error(
                        index, field, f"Duplicate tag '{value}' within this batch."
                    )

        # Conflicts with bags that already exist on any case.
        claimed_values = list(positions.keys())
        if claimed_values:
            existing = DrugBag.objects.filter(
                Q(seal_tag_numbers__in=claimed_values)
                | Q(new_seal_tag_numbers__in=claimed_values)
            ).select_related("submission")
            taken = {}
            for bag in existing:
                case_number = bag.submission.case_number
                if bag.seal_tag_numbers in positions:
                    taken.setdefault(bag.seal_tag_numbers, case_number)
                if bag.new_seal_tag_numbers and bag.new_seal_tag_numbers in positions:
                    taken.setdefault(bag.new_seal_tag_numbers, case_number)
            for value, case_number in taken.items():
                for index, field in positions[value]:
                    add_error(
                        index,
                        field,
                        f"Tag '{value}' already exists on case {case_number}.",
                    )

        if any(errors):
            raise serializers.ValidationError({"bags": errors})
        return attrs
