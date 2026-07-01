from rest_framework import serializers

from ..models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    """Serialiser for the final certificate (single PDF, no signature)."""

    pdf_url = serializers.SerializerMethodField()
    submission = serializers.PrimaryKeyRelatedField(read_only=True)
    submission_case_number = serializers.SerializerMethodField()
    defendant_names = serializers.SerializerMethodField()
    bag_ids = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "submission",
            "submission_case_number",
            "defendant_names",
            "bag_ids",
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

    def get_submission_case_number(self, obj):
        if obj.submission:
            return obj.submission.case_number
        return None

    def get_defendant_names(self, obj):
        if obj.submission:
            defendants = obj.submission.defendants.all()
            if defendants:
                return ", ".join(d.full_name for d in defendants)
        return None

    def get_bag_ids(self, obj):
        return list(obj.bags.values_list("id", flat=True))
