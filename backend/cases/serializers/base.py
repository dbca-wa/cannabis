from django.contrib.auth import get_user_model
from rest_framework import serializers

from defendants.serializers import DefendantTinySerializer
from police.models import PoliceOfficer

from ..models import Case
from .bags import DrugBagSerializer
from .certificates import CertificateSerializer
from .dashboard import CasePhaseHistorySerializer
from .invoices import AdditionalInvoiceFeeSerializer, InvoiceSerializer

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
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = PoliceOfficer
        fields = ["id", "full_name", "badge_number", "station_name"]


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
    invoice_id = serializers.SerializerMethodField()
    bags_count = serializers.SerializerMethodField()
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
            "invoice_id",
            "bags_count",
            "defendants_count",
            "defendant_names",
            "cannabis_present",
            "created_at",
        ]

    def get_bags_count(self, obj):
        return obj.bags.count()

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
        """Return ID of first certificate that has a PDF (signed preferred, then unsigned)."""
        cert = obj.certificates.first()
        if cert and (cert.signed_pdf_file or cert.pdf_file):
            return cert.pk
        return None

    def get_invoice_id(self, obj):
        """Return ID of first invoice that has a PDF."""
        invoice = obj.invoices.first()
        if invoice and invoice.pdf_file:
            return invoice.pk
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
    invoices = InvoiceSerializer(many=True, read_only=True)
    additional_fees = AdditionalInvoiceFeeSerializer(many=True, read_only=True)
    phase_history = CasePhaseHistorySerializer(many=True, read_only=True)

    # Computed properties
    cannabis_present = serializers.ReadOnlyField()
    bags_received = serializers.ReadOnlyField()
    total_plants = serializers.ReadOnlyField()

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
            # Finance fields
            "forensic_hours",
            "fuel_distance_km",
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
            "invoices",
            "additional_fees",
            "phase_history",
            # Computed properties
            "cannabis_present",
            "bags_received",
            "total_plants",
            # Workflow timestamps
            "finance_approved_at",
            "botanist_approved_at",
            "certificates_generated_at",
            "invoices_generated_at",
            "emails_sent_at",
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
        ]
