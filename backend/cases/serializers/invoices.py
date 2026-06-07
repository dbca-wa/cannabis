from rest_framework import serializers

from ..models import AdditionalInvoiceFee, Invoice


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
