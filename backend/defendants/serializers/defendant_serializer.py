"""Defendant serializers."""

from rest_framework import serializers

from defendants.models import Defendant


class DefendantSerializer(serializers.ModelSerializer):
    """Complete serializer for defendants"""

    pdf_name = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    cases_count = serializers.SerializerMethodField()
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Defendant
        fields = [
            "id",
            "given_names",
            "last_name",
            "full_name",
            "pdf_name",
            "cases_count",
            "case_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "full_name",
            "pdf_name",
            "cases_count",
            "case_count",
        ]

    def get_cases_count(self, obj):
        """Get number of cases (submissions) this defendant is involved in"""
        if hasattr(obj, "cases_count"):
            return obj.cases_count
        return obj.cases.count()

    def validate_last_name(self, value):
        """Ensure last name is provided"""
        if not value or not value.strip():
            raise serializers.ValidationError("Last name is required.")
        return value.strip()

    def validate_given_names(self, value):
        """Clean given names if provided"""
        if value:
            return value.strip()
        return value

    def validate(self, attrs):
        """Check for duplicate defendant (same given_names + last_name, case-insensitive)"""
        given_names = attrs.get("given_names") or ""
        last_name = attrs.get("last_name", "")

        qs = Defendant.objects.filter(
            last_name__iexact=last_name,
        )
        if given_names:
            qs = qs.filter(given_names__iexact=given_names)
        else:
            qs = qs.filter(given_names__isnull=True) | qs.filter(given_names="")

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            full = f"{given_names} {last_name}".strip()
            raise serializers.ValidationError(
                {"last_name": f"A defendant named '{full}' already exists."}
            )
        return attrs


class DefendantTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for defendant references"""

    full_name = serializers.ReadOnlyField()
    cases_count = serializers.SerializerMethodField()
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Defendant
        fields = [
            "id",
            "given_names",
            "last_name",
            "full_name",
            "cases_count",
            "case_count",
        ]

    def get_cases_count(self, obj):
        """Get number of cases (submissions) this defendant is involved in"""
        if hasattr(obj, "cases_count"):
            return obj.cases_count
        return obj.cases.count()
