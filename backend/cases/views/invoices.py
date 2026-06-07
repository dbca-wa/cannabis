from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_500_INTERNAL_SERVER_ERROR,
)
from rest_framework.views import APIView

from ..models import AdditionalInvoiceFee, Case, Invoice
from ..serializers import AdditionalInvoiceFeeSerializer, InvoiceSerializer
from ..services import generate_invoice, regenerate_invoice_pdf
from ..services.pdf_test_service import TestPDFService


class AllInvoicesListView(ListCreateAPIView):
    """
    GET: List all invoices across all submissions.
    POST: Create a new invoice (requires submission ID in request body).
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Invoice.objects.select_related("submission").order_by("-created_at")
        search = self.request.query_params.get("search")
        submission = self.request.query_params.get("submission")
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(submission__case_number__icontains=search)
            )
        if submission:
            queryset = queryset.filter(submission_id=submission)
        return queryset


class InvoiceListView(ListCreateAPIView):
    """
    GET: List invoices for a submission
    POST: Create new invoice
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return Invoice.objects.filter(submission_id=pk).order_by("-created_at")

    def perform_create(self, serializer):
        pk = self.kwargs.get("pk")
        try:
            submission = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise ValidationError("Submission not found")

        invoice = serializer.save(submission=submission)
        settings.LOGGER.info(
            f"User {self.request.user} created invoice {invoice.invoice_number}"
        )


class InvoiceDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve invoice details
    PUT/PATCH: Update invoice
    DELETE: Delete invoice
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    queryset = Invoice.objects.all()

    def perform_update(self, serializer):
        invoice = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated invoice {invoice.invoice_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.info(
            f"User {self.request.user} deleted invoice {instance.invoice_number}"
        )
        instance.delete()


class InvoiceDownloadView(APIView):
    """Download an invoice PDF file."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        invoice = get_object_or_404(Invoice, pk=pk)
        if not invoice.pdf_file:
            raise NotFound("Invoice PDF has not been generated yet.")
        response = HttpResponse(invoice.pdf_file.read(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{invoice.invoice_number}.pdf"'
        )
        return response


class AdditionalInvoiceFeeListView(ListCreateAPIView):
    """
    GET: List additional fees for a submission
    POST: Create new additional fee
    """

    serializer_class = AdditionalInvoiceFeeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return AdditionalInvoiceFee.objects.filter(submission_id=pk).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        fee = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created additional fee: {fee}")


class InvoiceGenerateView(APIView):
    """Generate an invoice PDF for a submission.

    POST /cases/{pk}/invoices/generate

    Expects `customer_number` in the request body. Creates the invoice record,
    renders the PDF, and returns the invoice ID and PDF URL.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        submission = get_object_or_404(Case, pk=pk)
        customer_number = request.data.get("customer_number", "").strip()

        invoice = generate_invoice(submission, customer_number, request.user)

        serializer = InvoiceSerializer(invoice, context={"request": request})
        return Response(serializer.data, status=HTTP_201_CREATED)


class InvoicePdfView(APIView):
    """Download an invoice PDF scoped to a submission.

    GET /cases/{pk}/invoices/{invoice_id}/pdf

    Returns the PDF file as a downloadable attachment.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, invoice_id):
        submission = get_object_or_404(Case, pk=pk)
        invoice = get_object_or_404(Invoice, pk=invoice_id, submission=submission)

        if not invoice.pdf_file:
            raise NotFound("Invoice PDF has not been generated yet.")

        response = HttpResponse(invoice.pdf_file.read(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{invoice.invoice_number}.pdf"'
        )
        return response


class InvoiceRegenerateView(APIView):
    """Re-render the PDF for an existing invoice.

    POST /cases/{pk}/invoices/{invoice_id}/regenerate

    Rebuilds the context from current submission data and overwrites the
    stored PDF file.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, invoice_id):
        submission = get_object_or_404(Case, pk=pk)
        invoice = get_object_or_404(Invoice, pk=invoice_id, submission=submission)

        invoice = regenerate_invoice_pdf(invoice)

        serializer = InvoiceSerializer(invoice, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)


class GenerateTestInvoiceView(APIView):
    """POST: Generate a test invoice PDF with mock data. Returns raw PDF bytes."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            pdf_bytes = TestPDFService.generate_test_invoice()
        except Exception as e:
            return Response(
                {"detail": f"PDF generation failed: {str(e)}"},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return HttpResponse(pdf_bytes, content_type="application/pdf")
