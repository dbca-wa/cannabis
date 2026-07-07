from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case, Certificate
from ..serializers import CertificateSerializer
from ..services import CertificateService
from ..services.pdf_test_service import TestPDFService


class AllCertificatesListView(ListAPIView):
    """GET: list all certificates across all cases.

    Certificates are created by generating a form's certificate, not through
    this endpoint. Supports a free-text search and optional case/form filters.
    """

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]

    def get_queryset(self):
        queryset = Certificate.objects.select_related("form", "form__case").order_by(
            "-created_at"
        )
        search = self.request.query_params.get("search")
        case_id = self.request.query_params.get("case")
        form_id = self.request.query_params.get("form")
        if search:
            queryset = queryset.filter(
                Q(certificate_number__icontains=search)
                | Q(form__case__case_number__icontains=search)
            )
        if case_id:
            queryset = queryset.filter(form__case_id=case_id)
        if form_id:
            queryset = queryset.filter(form_id=form_id)
        return queryset


class CertificateListView(ListAPIView):
    """GET: list the certificates for a case, reached through its forms."""

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return (
            Certificate.objects.filter(form__case_id=pk)
            .select_related("form", "form__case")
            .order_by("-created_at")
        )


class CertificateDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve certificate details
    PUT/PATCH: Update certificate
    DELETE: Delete certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [HasAppAccess]
    queryset = Certificate.objects.select_related("form", "form__case")

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


class CertificatePdfView(APIView):
    """Download a certificate PDF scoped to a case.

    GET /cases/{pk}/certificates/{certificate_id}/pdf
    """

    permission_classes = [HasAppAccess]

    def get(self, request, pk, certificate_id):
        case = get_object_or_404(Case, pk=pk)
        certificate = CertificateService.get_certificate_for_case(case, certificate_id)
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
        case = get_object_or_404(Case, pk=pk)
        certificate = CertificateService.get_certificate_for_case(case, certificate_id)
        certificate = CertificateService.regenerate_certificate_pdf(certificate)
        serializer = CertificateSerializer(certificate, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)
