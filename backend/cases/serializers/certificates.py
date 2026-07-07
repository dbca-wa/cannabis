from rest_framework import serializers

from ..models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    """Serialiser for the final certificate (single PDF, no signature).

    A certificate belongs to exactly one Priority 3 form; its case, defendants
    and covered bags are reached through that form.
    """

    pdf_url = serializers.SerializerMethodField()
    form = serializers.PrimaryKeyRelatedField(read_only=True)
    case_id = serializers.SerializerMethodField()
    case_number = serializers.SerializerMethodField()
    defendant_names = serializers.SerializerMethodField()
    bag_ids = serializers.SerializerMethodField()
    batch_id = serializers.IntegerField(source="batch.id", read_only=True, default=None)
    batch_number = serializers.CharField(
        source="batch.batch_number", read_only=True, default=None
    )
    is_batch_eligible = serializers.ReadOnlyField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "form",
            "case_id",
            "case_number",
            "defendant_names",
            "bag_ids",
            "batch_id",
            "batch_number",
            "is_batch_eligible",
            "certified_date",
            "additional_notes",
            "pdf_generating",
            "pdf_file",
            "pdf_url",
            "pdf_size",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "certificate_number", "created_at", "updated_at"]

    def get_pdf_url(self, obj):
        """Get full URL for the certificate PDF."""
        pdf = obj.pdf_file
        if pdf:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(pdf.url)
            return pdf.url
        return None

    def get_case_id(self, obj):
        case = obj.form.case if obj.form_id else None
        return case.pk if case else None

    def get_case_number(self, obj):
        case = obj.form.case if obj.form_id else None
        return case.case_number if case else None

    def get_defendant_names(self, obj):
        case = obj.form.case if obj.form_id else None
        if case:
            defendants = case.defendants.all()
            if defendants:
                return ", ".join(d.full_name for d in defendants)
        return None

    def get_bag_ids(self, obj):
        return list(obj.form.bags.values_list("id", flat=True))
