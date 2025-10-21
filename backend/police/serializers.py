from rest_framework import serializers
from .models import PoliceStation, PoliceOfficer


class PoliceStationSerializer(serializers.ModelSerializer):
    """Complete serializer for Police Station"""

    officer_count = serializers.SerializerMethodField()

    class Meta:
        model = PoliceStation
        fields = [
            "id",
            "name",
            "address",
            "phone",
            "officer_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "officer_count"]

    def get_officer_count(self, obj):
        """Get number of officers assigned to this station"""
        return obj.officers.count()


class PoliceStationTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for lists and foreign key references"""

    officer_count = serializers.SerializerMethodField()

    class Meta:
        model = PoliceStation
        fields = ["id", "name", "phone", "officer_count"]
        read_only_fields = ["officer_count"]

    def get_officer_count(self, obj):
        """Get number of officers assigned to this station"""
        return obj.officers.count()


class PoliceOfficerSerializer(serializers.ModelSerializer):
    """Complete serializer for Police Officer"""

    station_details = PoliceStationTinySerializer(source="station", read_only=True)
    full_name = serializers.ReadOnlyField()
    is_sworn = serializers.ReadOnlyField()
    rank_display = serializers.CharField(source="get_rank_display", read_only=True)

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "first_name",
            "last_name",
            "full_name",
            "rank",
            "rank_display",
            "is_sworn",
            "station",
            "station_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "full_name",
            "is_sworn",
            "rank_display",
        ]

    def validate_badge_number(self, value):
        """Ensure badge numbers are unique when provided"""
        if (
            value
            and PoliceOfficer.objects.filter(badge_number=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .exists()
        ):
            raise serializers.ValidationError("Badge number must be unique.")
        return value


class PoliceOfficerTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for lists and references"""

    full_name = serializers.ReadOnlyField()
    rank_display = serializers.CharField(source="get_rank_display", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "first_name",  # Added for frontend form pre-selection
            "last_name",  # Added for frontend form pre-selection
            "full_name",
            "rank",  # Added rank field for frontend form pre-selection
            "rank_display",
            "station",  # Added station ID for frontend form pre-selection
            "station_name",
            "is_sworn",
        ]


class PoliceOfficerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new officers"""

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "first_name",
            "last_name",
            "rank",
            "station",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        """Ensure at least first or last name is provided"""
        if not attrs.get("first_name") and not attrs.get("last_name"):
            raise serializers.ValidationError(
                "At least first name or last name must be provided."
            )
        return attrs
