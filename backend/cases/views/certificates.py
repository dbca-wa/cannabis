from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.views import APIView

from ..models import Case, Certificate
from ..serializers import CertificateSerializer
from ..services import CertificateService
from ..services.pdf_test_service import TestPDFService


class AllCertificatesListView(ListCreateAPIView):
    """
    GET: List all certificates across all submissions.
    POST: Create a new certificate (requires submission ID in request body).
    """

    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]

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
    GET: List certificates for a submission
    POST: Create new certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return Certificate.objects.filter(submission_id=pk).order_by("-created_at")

    def perform_create(self, serializer):
        pk = self.kwargs.get("pk")
        try:
            submission = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise ValidationError("Submission not found")

        certificate = serializer.save(submission=submission)
        settings.LOGGER.info(
            f"User {self.request.user} created certificate {certificate.certificate_number}"
        )


class CertificateDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve certificate details
    PUT/PATCH: Update certificate
    DELETE: Delete certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]
    queryset = Certificate.objects.all()

    def perform_update(self, serializer):
        certificate = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated certificate {certificate.certificate_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.info(
            f"User {self.request.user} deleted certificate {instance.certificate_number}"
        )
        instance.delete()


class CertificateDownloadView(APIView):
    """Download a certificate PDF file."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        certificate = get_object_or_404(Certificate, pk=pk)
        if not certificate.pdf_file:
            raise NotFound("Certificate PDF has not been generated yet.")
        response = HttpResponse(
            certificate.pdf_file.read(), content_type="application/pdf"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{certificate.certificate_number}.pdf"'
        )
        return response


class GenerateTestCertificateView(APIView):
    """POST: Generate a test certificate PDF with mock data. Returns raw PDF bytes."""

    permission_classes = [IsAuthenticated]
    VALID_VARIANTS = {"base", "aptos", "semi_aptos"}

    def post(self, request):
        variant = request.query_params.get("variant", "base")
        if variant not in self.VALID_VARIANTS:
            return Response(
                {
                    "detail": f"Invalid variant. Choose from: {', '.join(sorted(self.VALID_VARIANTS))}"
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
    """Generate an unsigned certificate PDF for a submission.

    POST /submissions/{submission_id}/certificates/generate/

    Validates the submission, creates the certificate record, renders the PDF,
    and returns the certificate data including the PDF URL.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from ..services import generate_unsigned_certificate

        submission = get_object_or_404(Case, pk=pk)

        try:
            certificate = generate_unsigned_certificate(submission, request.user)
        except ValidationError:
            raise

        serializer = CertificateSerializer(certificate, context={"request": request})
        return Response(serializer.data, status=HTTP_201_CREATED)


class CertificatePdfView(APIView):
    """Download a certificate PDF scoped to a submission.

    GET /submissions/{submission_id}/certificates/{certificate_id}/pdf/

    Returns the PDF file as a downloadable attachment.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, certificate_id):
        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )

        if not certificate.pdf_file:
            raise NotFound("Certificate PDF has not been generated yet.")

        response = HttpResponse(
            certificate.pdf_file.read(), content_type="application/pdf"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{certificate.certificate_number}.pdf"'
        )
        return response


class CertificateRegenerateView(APIView):
    """Regenerate the PDF for an existing certificate.

    POST /cases/{pk}/certificates/{certificate_id}/regenerate

    Re-renders the PDF from current submission data. Returns 403 if the
    certificate is locked (signed).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, certificate_id):
        from ..services import regenerate_certificate_pdf

        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )

        if certificate.is_locked:
            raise PermissionDenied(
                "Certificate is locked after signing. "
                "The assigned botanist must unlock it before regenerating."
            )

        try:
            certificate = regenerate_certificate_pdf(certificate)
        except ValidationError:
            raise

        serializer = CertificateSerializer(certificate, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)


class UnlockCertificateView(APIView):
    """Unlock a certificate for unsigned PDF regeneration.

    POST /api/v1/cases/{pk}/certificates/{certificate_id}/unlock

    Only the assigned botanist or admin/staff users may unlock.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, certificate_id):
        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )
        certificate = CertificateService.unlock_certificate(certificate, request.user)
        serializer = CertificateSerializer(certificate)
        return Response(serializer.data, status=HTTP_200_OK)


class SignCertificateView(APIView):
    """Sign an unsigned certificate by embedding the botanist's digital signature.

    POST /api/v1/cases/{pk}/certificates/{certificate_id}/sign

    Only the assigned botanist for the submission may invoke this endpoint.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, certificate_id):
        submission = get_object_or_404(Case, pk=pk)
        certificate = get_object_or_404(
            Certificate, pk=certificate_id, submission=submission
        )
        certificate = CertificateService.sign_certificate(
            submission, certificate, request.user
        )
        serializer = CertificateSerializer(certificate)
        return Response(serializer.data, status=HTTP_200_OK)
