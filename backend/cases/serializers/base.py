from django.contrib.auth import get_user_model
from rest_framework import serializers

from defendants.serializers import DefendantTinySerializer
from police.models import PoliceOfficer

from ..models import Case, Certificate
from .dashboard import CasePhaseHistorySerializer
from .forms import Priority3FormSerializer, Priority3FormTinySerializer

User = get_user_model()


def _derived_status_label(status):
    """Return the human-readable label for a case's derived status value."""
    try:
        return Case.PhaseChoices(status).label
    except ValueError:
        return str(status)


class UserTinySerializer(serializers.ModelSerializer):
    """Lightweight user serializer for staff assignments"""

    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "role"]


class PoliceOfficerTinySerializer(serializers.ModelSerializer):
    """Lightweight police officer serializer"""

    full_name = serializers.ReadOnlyField()
    rank = serializers.CharField(read_only=True)
    rank_display = serializers.CharField(source="get_rank_display", read_only=True)
    given_names = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = PoliceOfficer
        fields = [
            "id",
            "full_name",
            "rank",
            "rank_display",
            "badge_number",
            "given_names",
            "last_name",
            "station_name",
        ]


class CaseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for case lists"""

    derived_status = serializers.SerializerMethodField()
    derived_status_display = serializers.SerializerMethodField()
    requesting_officer_name = serializers.CharField(
        source="requesting_officer.full_name", read_only=True
    )
    requesting_officer_rank = serializers.CharField(
        source="requesting_officer.get_rank_display", read_only=True, default=None
    )
    requesting_officer_station = serializers.CharField(
        source="requesting_officer.station.name", read_only=True, default=None
    )
    submitting_officer_name = serializers.CharField(
        source="submitting_officer.full_name", read_only=True
    )
    submitting_officer_rank = serializers.CharField(
        source="submitting_officer.get_rank_display", read_only=True, default=None
    )
    submitting_officer_station = serializers.CharField(
        source="submitting_officer.station.name", read_only=True, default=None
    )
    station_name = serializers.CharField(
        source="station.name", read_only=True, default=None
    )
    certificate_id = serializers.SerializerMethodField()
    forms = Priority3FormTinySerializer(many=True, read_only=True)
    forms_count = serializers.SerializerMethodField()
    bags_count = serializers.SerializerMethodField()
    certificates_count = serializers.SerializerMethodField()
    defendants_count = serializers.SerializerMethodField()
    defendant_names = serializers.SerializerMethodField()
    cannabis_present = serializers.ReadOnlyField()

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "derived_status",
            "derived_status_display",
            "received",
            "requesting_officer_name",
            "requesting_officer_rank",
            "requesting_officer_station",
            "submitting_officer_name",
            "submitting_officer_rank",
            "submitting_officer_station",
            "station_name",
            "certificate_id",
            "forms",
            "forms_count",
            "bags_count",
            "certificates_count",
            "defendants_count",
            "defendant_names",
            "cannabis_present",
            "created_at",
        ]

    def get_derived_status(self, obj):
        return str(obj.derived_status)

    def get_derived_status_display(self, obj):
        return _derived_status_label(obj.derived_status)

    def get_forms_count(self, obj):
        return obj.forms.count()

    def get_bags_count(self, obj):
        return obj.bag_count

    def get_certificates_count(self, obj):
        return Certificate.objects.filter(form__case=obj).count()

    def get_defendants_count(self, obj):
        return obj.defendants.count()

    def get_defendant_names(self, obj):
        """Return list of defendant names in legal form (LAST, Given)."""
        defendants = obj.defendants.all()
        if not defendants:
            return []
        names = []
        for d in defendants:
            if d.last_name and d.given_names:
                names.append(f"{d.last_name.upper()}, {d.given_names}")
            elif d.last_name:
                names.append(d.last_name.upper())
            else:
                names.append("Unknown")
        return names

    def get_certificate_id(self, obj):
        """Return the id of the first certificate on this case with a PDF."""
        certificate = (
            Certificate.objects.filter(form__case=obj)
            .exclude(pdf_file="")
            .order_by("created_at")
            .first()
        )
        return certificate.pk if certificate else None


class CaseSerializer(serializers.ModelSerializer):
    """Complete serializer for cases"""

    derived_status = serializers.SerializerMethodField()
    derived_status_display = serializers.SerializerMethodField()

    # Staff assignments
    approved_botanist_details = UserTinySerializer(
        source="approved_botanist", read_only=True
    )
    finance_officer_details = UserTinySerializer(
        source="finance_officer", read_only=True
    )
    requesting_officer_details = PoliceOfficerTinySerializer(
        source="requesting_officer", read_only=True
    )
    submitting_officer_details = PoliceOfficerTinySerializer(
        source="submitting_officer", read_only=True
    )

    # Related objects
    defendants_details = DefendantTinySerializer(
        source="defendants", many=True, read_only=True
    )
    forms = Priority3FormSerializer(many=True, read_only=True)
    phase_history = CasePhaseHistorySerializer(many=True, read_only=True)

    # Per-case counts
    forms_count = serializers.SerializerMethodField()
    bags_count = serializers.SerializerMethodField()
    certificates_count = serializers.SerializerMethodField()

    # Computed properties
    cannabis_present = serializers.ReadOnlyField()
    bags_received = serializers.ReadOnlyField()
    total_plants = serializers.ReadOnlyField()

    def get_derived_status(self, obj):
        return str(obj.derived_status)

    def get_derived_status_display(self, obj):
        return _derived_status_label(obj.derived_status)

    def get_forms_count(self, obj):
        return obj.forms.count()

    def get_bags_count(self, obj):
        return obj.bag_count

    def get_certificates_count(self, obj):
        return Certificate.objects.filter(form__case=obj).count()

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "received",
            "derived_status",
            "derived_status_display",
            "internal_comments",
            # Staff assignments
            "approved_botanist",
            "approved_botanist_details",
            "finance_officer",
            "finance_officer_details",
            "requesting_officer",
            "requesting_officer_details",
            "submitting_officer",
            "submitting_officer_details",
            # Defendants
            "defendants",
            "defendants_details",
            # Related objects
            "forms",
            "phase_history",
            # Per-case counts
            "forms_count",
            "bags_count",
            "certificates_count",
            # Computed properties
            "cannabis_present",
            "bags_received",
            "total_plants",
            # Audit fields
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
