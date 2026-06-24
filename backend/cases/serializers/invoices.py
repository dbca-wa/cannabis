from decimal import Decimal

from rest_framework import serializers

from ..models import AdditionalInvoiceFee, Invoice

FEE_TYPE_CHOICES = ["certificate", "bag", "fuel", "call_out", "forensic"]


class LineItemSerializer(serializers.Serializer):
    """Serializer for a single line item in the invoice generation request."""

    fee_type = serializers.ChoiceField(choices=FEE_TYPE_CHOICES)
    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )


class InvoiceGenerateRequestSerializer(serializers.Serializer):
    """Request serializer for the invoice generation endpoint."""

    customer_number = serializers.CharField(max_length=255)
    line_items = LineItemSerializer(many=True, required=False)
    tax_enabled = serializers.BooleanField(default=True)

    def validate_customer_number(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("This field is required.")
        return stripped


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
