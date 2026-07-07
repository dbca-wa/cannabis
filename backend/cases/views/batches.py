"""Batch views — create, list, detail, download, invoice-raised, delete, export."""

import csv

from django.http import HttpResponse
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_204_NO_CONTENT
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Batch
from ..serializers import (
    BatchCreateSerializer,
    BatchDetailSerializer,
    BatchListSerializer,
    InvoiceRaisedSerializer,
)
from ..services import BatchService

VALID_ORDERINGS = {
    "created_at",
    "-created_at",
    "certificate_count",
    "-certificate_count",
    "bag_count",
    "-bag_count",
    "total",
    "-total",
}


class BatchListCreateView(ListAPIView):
    """GET: list batches (sortable). POST: create a batch from case ids."""

    serializer_class = BatchListSerializer
    permission_classes = [HasAppAccess]
    # The Batches page renders a single non-paginated, client-sortable table,
    # so return the full list as a bare array rather than a paginated envelope.
    pagination_class = None

    def get_queryset(self):
        # Batch tallies and the "cases" column derive from the batch's
        # certificates and their forms' cases/bags.
        queryset = Batch.objects.prefetch_related(
            "certificates__form__case__approved_botanist",
            "certificates__form__case__submitting_officer",
            "certificates__form__bags",
        )
        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering not in VALID_ORDERINGS:
            ordering = "-created_at"
        return queryset.order_by(ordering)

    def post(self, request):
        serializer = BatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = BatchService.create_batch(
            serializer.validated_data["certificate_ids"], request.user
        )
        out = BatchDetailSerializer(batch, context={"request": request})
        return Response(out.data, status=HTTP_201_CREATED)


class BatchDetailView(APIView):
    """GET: batch detail. DELETE: delete batch and free its cases."""

    permission_classes = [HasAppAccess]

    def get(self, request, pk):
        batch = BatchService.get_batch(pk)
        serializer = BatchDetailSerializer(batch, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)

    def delete(self, request, pk):
        batch = BatchService.get_batch(pk)
        BatchService.delete_batch(batch, request.user)
        return Response(status=HTTP_204_NO_CONTENT)


class BatchInvoiceRaisedView(APIView):
    """POST: record a unique invoice-raised number; completes the batch's cases.
    DELETE: clear the invoice-raised number; returns the cases to In Batch."""

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        batch = BatchService.get_batch(pk)
        serializer = InvoiceRaisedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = BatchService.record_invoice_raised(
            batch, serializer.validated_data["invoice_raised_number"], request.user
        )
        out = BatchDetailSerializer(batch, context={"request": request})
        return Response(out.data, status=HTTP_200_OK)

    def delete(self, request, pk):
        batch = BatchService.get_batch(pk)
        batch = BatchService.unset_invoice_raised(batch, request.user)
        out = BatchDetailSerializer(batch, context={"request": request})
        return Response(out.data, status=HTTP_200_OK)


class BatchDownloadView(APIView):
    """GET: stream the batch ZIP (rebuilding it if missing)."""

    permission_classes = [HasAppAccess]

    def get(self, request, pk):
        batch = BatchService.get_batch(pk)
        if not batch.zip_file:
            BatchService.rebuild_zip(batch)
        batch.zip_file.open("rb")
        data = batch.zip_file.read()
        batch.zip_file.close()
        response = HttpResponse(data, content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="{batch.batch_number}.zip"'
        )
        return response


class BatchExportView(APIView):
    """GET: export all batches as CSV with individual columns."""

    permission_classes = [HasAppAccess]

    def get(self, request):
        batches = Batch.objects.prefetch_related("certificates").order_by("-created_at")
        rows = BatchService.export_rows(batches)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="batches.csv"'
        fieldnames = [
            "batch_number",
            "date",
            "certificates",
            "cert_rate",
            "cert_cost",
            "bags",
            "bag_rate",
            "bag_cost",
            "tax_rate",
            "subtotal",
            "tax",
            "total",
            "certificate_numbers",
            "invoice_raised",
        ]
        writer = csv.DictWriter(response, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return response
