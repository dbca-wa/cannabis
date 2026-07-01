"""Police officer serializers."""

from django.db.models import Q
from rest_framework import serializers

from police.models import PoliceOfficer

from .station_serializer import PoliceStationTinySerializer


class PoliceOfficerSerializer(serializers.ModelSerializer):
    """Complete serializer for Police Officer"""

    station_details = PoliceStationTinySerializer(source="station", read_only=True)
    full_name = serializers.ReadOnlyField()
    is_sworn = serializers.ReadOnlyField()
    rank_display = serializers.CharField(source="get_rank_display", read_only=True)
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "given_names",
            "last_name",
            "full_name",
            "rank",
            "rank_display",
            "is_sworn",
            "station",
            "station_details",
            "case_count",
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
            "case_count",
        ]

    def validate_given_names(self, value):
        """Normalise first name to title case on save.

        NOTE: .title() doesn't handle compound prefixes like "Mc" or "Mac"
        perfectly (e.g. "McDonald" becomes "Mcdonald"). Known limitation
        maintained for consistency with the ETL pipeline.
        """
        if value:
            return value.title()
        return value

    def validate_last_name(self, value):
        """Normalise last name to title case on save.

        NOTE: .title() doesn't handle compound prefixes like "Mc" or "Mac"
        perfectly (e.g. "McDonald" becomes "Mcdonald"). Known limitation
        maintained for consistency with the ETL pipeline.
        """
        if value:
            return value.title()
        return value

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

    def validate(self, attrs):
        """Ensure officer name is unique within the same station."""
        given_names = (
            attrs.get("given_names")
            if "given_names" in attrs
            else (self.instance.given_names if self.instance else None)
        )
        last_name = (
            attrs.get("last_name")
            if "last_name" in attrs
            else (self.instance.last_name if self.instance else None)
        )
        station = (
            attrs.get("station")
            if "station" in attrs
            else (self.instance.station if self.instance else None)
        )

        if not last_name or not last_name.strip():
            raise serializers.ValidationError({"last_name": "Last name is required."})

        qs = PoliceOfficer.objects.filter(
            last_name__iexact=last_name,
        )

        # Handle given_names matching: NULL and "" should be treated as equivalent
        if given_names:
            qs = qs.filter(given_names__iexact=given_names)
        else:
            qs = qs.filter(Q(given_names__isnull=True) | Q(given_names=""))

        if station:
            qs = qs.filter(station=station)
        else:
            qs = qs.filter(station__isnull=True)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            station_name = station.name if station else "no station"
            full_name = (
                f"{given_names} {last_name}".strip() if given_names else last_name
            )
            raise serializers.ValidationError(
                {
                    "last_name": f"An officer named '{full_name}' already exists at {station_name}."
                }
            )
        return attrs


class PoliceOfficerTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for lists and references"""

    full_name = serializers.ReadOnlyField()
    rank_display = serializers.CharField(source="get_rank_display", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    case_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "given_names",
            "last_name",
            "full_name",
            "rank",
            "rank_display",
            "station",
            "station_name",
            "is_sworn",
            "case_count",
        ]


class PoliceOfficerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new officers"""

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "badge_number",
            "given_names",
            "last_name",
            "rank",
            "station",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        """Ensure at least first or last name is provided, and unique within station."""
        if not attrs.get("given_names") and not attrs.get("last_name"):
            raise serializers.ValidationError(
                "At least first name or last name must be provided."
            )

        given_names = attrs.get("given_names") or ""
        last_name = attrs.get("last_name") or ""
        station = attrs.get("station")

        if last_name:
            qs = PoliceOfficer.objects.filter(
                last_name__iexact=last_name,
            )

            # Handle given_names matching: NULL and "" are equivalent
            if given_names:
                qs = qs.filter(given_names__iexact=given_names)
            else:
                qs = qs.filter(Q(given_names__isnull=True) | Q(given_names=""))

            if station:
                qs = qs.filter(station=station)
            else:
                qs = qs.filter(station__isnull=True)

            if qs.exists():
                station_name = station.name if station else "no station"
                full_name = (
                    f"{given_names} {last_name}".strip() if given_names else last_name
                )
                raise serializers.ValidationError(
                    {
                        "last_name": f"An officer named '{full_name}' already exists at {station_name}."
                    }
                )
        return attrs

    def validate_given_names(self, value):
        """Normalise first name to title case on save.

        NOTE: .title() doesn't handle compound prefixes like "Mc" or "Mac"
        perfectly (e.g. "McDonald" becomes "Mcdonald"). Known limitation
        maintained for consistency with the ETL pipeline.
        """
        if value:
            return value.title()
        return value

    def validate_last_name(self, value):
        """Normalise last name to title case on save.

        NOTE: .title() doesn't handle compound prefixes like "Mc" or "Mac"
        perfectly (e.g. "McDonald" becomes "Mcdonald"). Known limitation
        maintained for consistency with the ETL pipeline.
        """
        if value:
            return value.title()
        return value
