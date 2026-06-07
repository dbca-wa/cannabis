from rest_framework import serializers

from ..models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    """Serialiser for certificates with dual PDF slot support."""

    pdf_url = serializers.SerializerMethodField()
    signed_pdf_url = serializers.SerializerMethodField()
    submission = serializers.PrimaryKeyRelatedField(read_only=True)
    submission_case_number = serializers.SerializerMethodField()
    defendant_names = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "submission",
            "submission_case_number",
            "defendant_names",
            "pdf_generating",
            "pdf_file",
            "pdf_url",
            "pdf_size",
            "signed_pdf_file",
            "signed_pdf_url",
            "signed_pdf_size",
            "is_locked",
            "locked_at",
            "signature_used_id",
            "signature_embedded_at",
            "signed_by",
            "file_hash_at_signing",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "certificate_number", "created_at", "updated_at"]

    def get_pdf_url(self, obj):
        """Get full URL for the unsigned PDF file."""
        if obj.pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def get_signed_pdf_url(self, obj):
        """Get full URL for the signed PDF file."""
        if obj.signed_pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.signed_pdf_file.url)
            return obj.signed_pdf_file.url
        return None

    def get_submission_case_number(self, obj):
        """Return the parent submission's case number."""
        if obj.submission:
            return obj.submission.case_number
        return None

    def get_defendant_names(self, obj):
        """Return a comma-separated string of defendant names."""
        if obj.submission:
            defendants = obj.submission.defendants.all()
            if defendants:
                return ", ".join(d.full_name for d in defendants)
        return None
