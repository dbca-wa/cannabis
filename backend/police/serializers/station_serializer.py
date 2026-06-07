"""Police station serializers."""

from rest_framework import serializers

from police.models import PoliceStation


class PoliceStationSerializer(serializers.ModelSerializer):
    """Complete serializer for Police Station"""

    officer_count = serializers.SerializerMethodField()
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PoliceStation
        fields = [
            "id",
            "name",
            "address",
            "phone",
            "officer_count",
            "case_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "officer_count",
            "case_count",
        ]

    def get_officer_count(self, obj):
        """Get number of officers assigned to this station"""
        return obj.officers.count()

    def validate_name(self, value):
        """Ensure station name is unique (case-insensitive)"""
        if not value or not value.strip():
            raise serializers.ValidationError("Station name is required.")
        value = value.strip()
        qs = PoliceStation.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"A station named '{value}' already exists."
            )
        return value


class PoliceStationTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for lists and foreign key references"""

    officer_count = serializers.SerializerMethodField()
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PoliceStation
        fields = ["id", "name", "phone", "officer_count", "case_count"]
        read_only_fields = ["officer_count", "case_count"]

    def get_officer_count(self, obj):
        """Get number of officers assigned to this station"""
        return obj.officers.count()
