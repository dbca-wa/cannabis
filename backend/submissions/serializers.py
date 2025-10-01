from rest_framework import serializers
from django.contrib.auth import get_user_model
from decimal import Decimal
from .models import (
    Defendant,
    Submission,
    DrugBag,
    BotanicalAssessment,
    Certificate,
    Invoice,
    AdditionalInvoiceFee,
)

User = get_user_model()


# ============================================================================
# DEFENDANT SERIALIZERS
# ============================================================================


class DefendantSerializer(serializers.ModelSerializer):
    """Complete serializer for defendants"""

    pdf_name = serializers.ReadOnlyField()

    class Meta:
        model = Defendant
        fields = [
            "id",
            "first_name",
            "last_name",
            "pdf_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DefendantTinySerializer(serializers.ModelSerializer):
    """Lightweight serializer for defendant references"""

    pdf_name = serializers.ReadOnlyField()

    class Meta:
        model = Defendant
        fields = ["id", "first_name", "last_name", "pdf_name"]


# ============================================================================
# BOTANICAL ASSESSMENT SERIALIZERS
# ============================================================================


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


# ============================================================================
# DRUG BAG SERIALIZERS
# ============================================================================


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
            "quantity",
            "suspected_as",
            "seal_tag_number",
            "new_seal_tag_number",
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
            "quantity",
            "suspected_as",
            "seal_tag_number",
            "new_seal_tag_number",
            "property_reference",
            "gross_weight",
            "net_weight",
        ]

    def validate_seal_tag_number(self, value):
        """Ensure seal tag numbers are unique within a submission"""
        submission = self.initial_data.get("submission")
        if (
            DrugBag.objects.filter(submission=submission, seal_tag_number=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .exists()
        ):
            raise serializers.ValidationError(
                "Seal tag number must be unique within submission."
            )
        return value


# ============================================================================
# CERTIFICATE & INVOICE SERIALIZERS
# ============================================================================


class CertificateSerializer(serializers.ModelSerializer):
    """Serializer for certificates"""

    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "pdf_generating",
            "pdf_file",
            "pdf_url",
            "pdf_size",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "certificate_number", "created_at", "updated_at"]

    def get_pdf_url(self, obj):
        """Get full URL for PDF file"""
        if obj.pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


class AdditionalInvoiceFeeSerializer(serializers.ModelSerializer):
    """Serializer for additional invoice fees"""

    claim_kind_display = serializers.CharField(
        source="get_claim_kind_display", read_only=True
    )
    calculated_cost = serializers.ReadOnlyField()

    class Meta:
        model = AdditionalInvoiceFee
        fields = [
            "id",
            "claim_kind",
            "claim_kind_display",
            "units",
            "description",
            "calculated_cost",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "calculated_cost"]


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices"""

    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "customer_number",
            "subtotal",
            "tax_amount",
            "total",
            "pdf_generating",
            "pdf_file",
            "pdf_url",
            "pdf_size",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "invoice_number",
            "subtotal",
            "tax_amount",
            "total",
            "created_at",
            "updated_at",
        ]

    def get_pdf_url(self, obj):
        """Get full URL for PDF file"""
        if obj.pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


# ============================================================================
# SUBMISSION SERIALIZERS
# ============================================================================


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
        model = "police.PoliceOfficer"  # String reference to avoid import issues
        fields = ["id", "full_name", "badge_number", "station_name"]


class SubmissionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for submission lists"""

    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    approved_botanist_name = serializers.CharField(
        source="approved_botanist.full_name", read_only=True
    )
    finance_officer_name = serializers.CharField(
        source="finance_officer.full_name", read_only=True
    )
    requesting_officer_name = serializers.CharField(
        source="requesting_officer.full_name", read_only=True
    )
    bags_count = serializers.SerializerMethodField()
    defendants_count = serializers.SerializerMethodField()
    cannabis_present = serializers.ReadOnlyField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "case_number",
            "phase",
            "phase_display",
            "received",
            "approved_botanist_name",
            "finance_officer_name",
            "requesting_officer_name",
            "bags_count",
            "defendants_count",
            "cannabis_present",
            "created_at",
        ]

    def get_bags_count(self, obj):
        return obj.bags.count()

    def get_defendants_count(self, obj):
        return obj.defendants.count()


class SubmissionSerializer(serializers.ModelSerializer):
    """Complete serializer for submissions"""

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

    # Computed properties
    cannabis_present = serializers.ReadOnlyField()
    bags_received = serializers.ReadOnlyField()
    total_plants = serializers.ReadOnlyField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "case_number",
            "received",
            "phase",
            "phase_display",
            "security_movement_envelope",
            "assessment_notes",
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


class SubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating submissions"""

    class Meta:
        model = Submission
        fields = [
            "case_number",
            "received",
            "security_movement_envelope",
            "requesting_officer",
            "submitting_officer",
            "defendants",
        ]

    def validate_case_number(self, value):
        """Ensure case numbers are unique"""
        if Submission.objects.filter(case_number=value).exists():
            raise serializers.ValidationError("Case number must be unique.")
        return value


class SubmissionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating submissions (restricted fields)"""

    class Meta:
        model = Submission
        fields = [
            "approved_botanist",
            "finance_officer",
            "assessment_notes",
            "defendants",
            "phase",
        ]

    def validate_phase(self, value):
        """Validate phase transitions"""
        if self.instance and self.instance.phase != value:
            # TODO: custom phase transition logic here if needed
            pass
        return value
