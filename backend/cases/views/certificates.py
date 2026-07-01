from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case, Certificate
from ..serializers import CertificateSerializer
from ..services import CertificateService
from ..services.pdf_test_service import TestPDFService


class AllCertificatesListView(ListCreateAPIView):
    """
    GET: List all certificates across all cases.
    POST: Create a new certificate (requires submission ID in request body).
    """

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]

    def get_queryset(self):
        queryset = Certificate.objects.select_related("submission").order_by(
            "-created_at"
        )
        search = self.request.query_params.get("search")
        submission = self.request.query_params.get("submission")
        if search:
            queryset = queryset.filter(
                Q(certificate_number__icontains=search)
                | Q(submission__case_number__icontains=search)
            )
        if submission:
            queryset = queryset.filter(submission_id=submission)
        return queryset


class CertificateListView(ListCreateAPIView):
    """
    GET: List certificates for a case
    POST: Create new certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return Certificate.objects.filter(submission_id=pk).order_by("-created_at")

    def perform_create(self, serializer):
        pk = self.kwargs.get("pk")
        try:
            submission = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise ValidationError("Case not found")

        certificate = serializer.save(submission=submission)
        settings.LOGGER.info(
            f"User {self.request.user} created certificate "
            f"{certificate.certificate_number}"
        )


class CertificateDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve certificate details
    PUT/PATCH: Update certificate
    DELETE: Delete certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]
    queryset = Certificate.objects.all()

    def perform_update(self, serializer):
        certificate = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated certificate "
            f"{certificate.certificate_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.info(
            f"User {self.request.user} deleted certificate "
            f"{instance.certificate_number}"
        )
        instance.delete()


def _certificate_pdf(certificate):
    """Return (file, filename) for the certificate PDF or raise NotFound."""
    pdf = certificate.pdf_file
    if not pdf:
        raise NotFound("Certificate PDF has not been generated yet.")
    return pdf, f"{certificate.certificate_number}.pdf"


class CertificateDownloadView(APIView):
    """Download a certificate PDF file."""

    permission_classes = [HasAppAccess]

    def get(self, request, pk):
        certificate = get_object_or_404(Certificate, pk=pk)
        pdf_file, filename = _certificate_pdf(certificate)
        response = HttpResponse(pdf_file.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class GenerateTestCertificateView(APIView):
    """POST: Generate a test certificate PDF with mock data. Returns raw PDF bytes."""

    permission_classes = [HasAppAccess]
    VALID_VARIANTS = {"base"}

    def post(self, request):
        variant = request.query_params.get("variant", "base")
        if variant not in self.VALID_VARIANTS:
            return Response(
                {
                    "detail": (
                        "Invalid variant. Choose from: "
                        f"{', '.join(sorted(self.VALID_VARIANTS))}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pdf_bytes = TestPDFService.generate_test_certificate(variant=variant)
        except Exception as e:
            return Response(
                {"detail": f"PDF generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return HttpResponse(pdf_bytes, content_type="application/pdf")


class CertificateGenerateView(APIView):
    """Generate certificate PDFs for a case (one per bag group, max 5 bags each).

    POST /cases/{pk}/certificates/generate

    Optional body: {"groups": [[bagId, ...], ...]} to control grouping.
    Without groups, bags are auto-grouped into chunks of five.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        submission = get_object_or_404(Case, pk=pk)
        groups = request.data.get("groups")
        group_notes = request.data.get("group_notes")

        certificates = CertificateService.generate_certificates(
            submission, request.user, groups=groups, group_notes=group_notes
        )

        serializer = CertificateSerializer(
            certificates, many=True, context={"request": request}
        )
        return Response(serializer.data, status=HTTP_201_CREATED)


class CertificatePdfView(APIView):
    """Download a certificate PDF scoped to a case.

    GET /cases/{pk}/certificates/{certificate_id}/pdf
    """

    permission_classes = [HasAppAccess]

    def get(self, request, pk, certificate_id):
        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )
        pdf_file, filename = _certificate_pdf(certificate)
        response = HttpResponse(pdf_file.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class CertificateRegenerateView(APIView):
    """Regenerate the PDF for an existing certificate (only before batching).

    POST /cases/{pk}/certificates/{certificate_id}/regenerate
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk, certificate_id):
        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )
        certificate = CertificateService.regenerate_certificate_pdf(certificate)
        serializer = CertificateSerializer(certificate, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)
