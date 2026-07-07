from rest_framework import serializers

from ..models import Priority3Form
from .bags import DrugBagSerializer
from .certificates import CertificateSerializer


def _scanned_image_url(serializer, obj):
    """Return the absolute URL for a form's scanned image, or None."""
    image = obj.scanned_image
    if not image:
        return None
    request = serializer.context.get("request")
    if request:
        return request.build_absolute_uri(image.url)
    return image.url


class Priority3FormTinySerializer(serializers.ModelSerializer):
    """Lightweight Priority 3 form serialiser for nesting in case listings.

    Keeps list payloads small by exposing a bag count and the form's single
    certificate rather than the full nested bag list.
    """

    case = serializers.PrimaryKeyRelatedField(read_only=True)
    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    scanned_image_url = serializers.SerializerMethodField()
    bags_count = serializers.SerializerMethodField()
    certificate = serializers.SerializerMethodField()

    class Meta:
        model = Priority3Form
        fields = [
            "id",
            "case",
            "scanned_image_url",
            "security_movement_envelope",
            "phase",
            "phase_display",
            "bags_count",
            "certificate",
            "marked_ready",
            "certificates_generated_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "security_movement_envelope",
            "phase",
            "certificates_generated_at",
            "completed_at",
        ]

    def get_scanned_image_url(self, obj):
        return _scanned_image_url(self, obj)

    def get_bags_count(self, obj):
        return obj.bags.count()

    def get_certificate(self, obj):
        certificate = getattr(obj, "certificate", None)
        if certificate is None:
            return None
        return CertificateSerializer(certificate, context=self.context).data


class Priority3FormSerializer(serializers.ModelSerializer):
    """Full Priority 3 form serialiser with its nested bags and certificate.

    A form belongs to exactly one case, owns at most five drug bags, and
    produces exactly one certificate. The workflow phase lives on the form; it
    is advanced by the workflow service rather than written through here.
    """

    case = serializers.PrimaryKeyRelatedField(read_only=True)
    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    scanned_image_url = serializers.SerializerMethodField()
    bags = DrugBagSerializer(many=True, read_only=True)
    certificate = serializers.SerializerMethodField()

    class Meta:
        model = Priority3Form
        fields = [
            "id",
            "case",
            "scanned_image_url",
            "security_movement_envelope",
            "additional_notes",
            "phase",
            "phase_display",
            "bags",
            "certificate",
            "marked_ready",
            "certificates_generated_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "phase",
            "certificates_generated_at",
            "completed_at",
        ]

    def get_scanned_image_url(self, obj):
        return _scanned_image_url(self, obj)

    def get_certificate(self, obj):
        certificate = getattr(obj, "certificate", None)
        if certificate is None:
            return None
        return CertificateSerializer(certificate, context=self.context).data
