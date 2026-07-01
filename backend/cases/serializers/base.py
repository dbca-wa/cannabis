from django.contrib.auth import get_user_model
from rest_framework import serializers

from defendants.serializers import DefendantTinySerializer
from police.models import PoliceOfficer

from ..models import Case
from .bags import DrugBagSerializer
from .certificates import CertificateSerializer
from .dashboard import CasePhaseHistorySerializer

User = get_user_model()


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

    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
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
    batch_id = serializers.IntegerField(source="batch.id", read_only=True, default=None)
    batch_number = serializers.CharField(
        source="batch.batch_number", read_only=True, default=None
    )
    batch_invoice_raised_number = serializers.CharField(
        source="batch.invoice_raised_number", read_only=True, default=None
    )
    is_batch_eligible = serializers.ReadOnlyField()
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
            "phase",
            "phase_display",
            "received",
            "requesting_officer_name",
            "requesting_officer_rank",
            "requesting_officer_station",
            "submitting_officer_name",
            "submitting_officer_rank",
            "submitting_officer_station",
            "station_name",
            "certificate_id",
            "batch_id",
            "batch_number",
            "batch_invoice_raised_number",
            "is_batch_eligible",
            "bags_count",
            "certificates_count",
            "defendants_count",
            "defendant_names",
            "cannabis_present",
            "created_at",
        ]

    def get_bags_count(self, obj):
        return obj.bags.count()

    def get_certificates_count(self, obj):
        return obj.certificates.count()

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
        """Return ID of the first certificate that has a generated PDF."""
        cert = obj.certificates.first()
        if cert and cert.pdf_file:
            return cert.pk
        return None


class CaseSerializer(serializers.ModelSerializer):
    """Complete serializer for cases"""

    phase_display = serializers.CharField(source="get_phase_display", read_only=True)

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
    bags = DrugBagSerializer(many=True, read_only=True)
    certificates = CertificateSerializer(many=True, read_only=True)
    phase_history = CasePhaseHistorySerializer(many=True, read_only=True)

    # Batching
    batch_id = serializers.IntegerField(source="batch.id", read_only=True, default=None)
    batch_number = serializers.CharField(
        source="batch.batch_number", read_only=True, default=None
    )
    batch_invoice_raised_number = serializers.CharField(
        source="batch.invoice_raised_number", read_only=True, default=None
    )
    is_batch_eligible = serializers.ReadOnlyField()

    # Computed properties
    cannabis_present = serializers.ReadOnlyField()
    bags_received = serializers.ReadOnlyField()
    total_plants = serializers.ReadOnlyField()

    # Optional stored Priority 3 form (read-only URL)
    police_form_url = serializers.SerializerMethodField()

    def get_police_form_url(self, obj):
        """Return the stored police-form URL, or None if not set."""
        if obj.police_form:
            try:
                return obj.police_form.url
            except ValueError:
                return None
        return None

    class Meta:
        model = Case
        fields = [
            "id",
            "case_number",
            "received",
            "phase",
            "phase_display",
            "security_movement_envelope",
            "internal_comments",
            "additional_notes",
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
            "bags",
            "certificates",
            "phase_history",
            # Batching
            "batch_id",
            "batch_number",
            "batch_invoice_raised_number",
            "is_batch_eligible",
            # Computed properties
            "cannabis_present",
            "bags_received",
            "total_plants",
            # Police form
            "police_form_url",
            # Workflow timestamps
            "certificates_generated_at",
            "completed_at",
            # Audit fields
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "cannabis_present",
            "bags_received",
            "total_plants",
            "phase_display",
            "police_form_url",
        ]
