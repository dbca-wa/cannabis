from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q, Count
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
import csv
import json
import io
import logging

logger = logging.getLogger(__name__)

from .models import Defendant
from .serializers import DefendantSerializer, DefendantTinySerializer


class DefendantListCreateView(ListCreateAPIView):
    """
    GET: List all defendants with search, pagination, and sorting
    POST: Create new defendant
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get("full") == "true":
                return DefendantSerializer
            return DefendantTinySerializer
        return DefendantSerializer

    def get_queryset(self):
        # Annotate with cases count for efficient querying
        queryset = Defendant.objects.annotate(
            cases_count=Count("submissions")
        ).order_by("last_name", "first_name")

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "last_name")

        # Validate ordering field
        valid_orderings = {
            "id": "id",
            "-id": "-id",
            "first_name": "first_name",
            "-first_name": "-first_name",
            "last_name": "last_name",
            "-last_name": "-last_name",
            "cases_count": "cases_count",
            "-cases_count": "-cases_count",
            "created_at": "created_at",
            "-created_at": "-created_at",
        }

        if ordering in valid_orderings:
            if ordering in ["cases_count", "-cases_count"]:
                # For cases count ordering, add secondary sort by name
                if ordering == "cases_count":
                    queryset = queryset.order_by(
                        "cases_count", "last_name", "first_name"
                    )
                else:  # -cases_count
                    queryset = queryset.order_by(
                        "-cases_count", "last_name", "first_name"
                    )
            else:
                queryset = queryset.order_by(valid_orderings[ordering])
        else:
            # Default ordering
            queryset = queryset.order_by("last_name", "first_name")

        return queryset

    def perform_create(self, serializer):
        defendant = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created defendant: {defendant}")


class DefendantRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve defendant details
    PUT/PATCH: Update defendant
    DELETE: Delete defendant (with validation for associated cases)
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return DefendantSerializer

    def get_queryset(self):
        # Annotate with cases count for efficient querying
        return Defendant.objects.annotate(cases_count=Count("submissions"))

    def perform_update(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} updated defendant: {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        # Check if defendant has associated cases
        cases_count = instance.submissions.count()
        if cases_count > 0:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                f"Cannot delete defendant {instance.full_name}. "
                f"They are associated with {cases_count} case(s). "
                f"Please remove them from all cases before deletion."
            )

        settings.LOGGER.warning(
            f"User {self.request.user} deleted defendant: {instance}"
        )
        super().perform_destroy(instance)


class DefendantExportView(APIView):
    """
    Export defendants data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get filtered queryset for export"""
        # Annotate with cases count for efficient querying
        queryset = Defendant.objects.annotate(
            cases_count=Count("submissions")
        ).order_by("last_name", "first_name")

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "last_name")

        # Validate ordering field
        valid_orderings = {
            "id": "id",
            "-id": "-id",
            "first_name": "first_name",
            "-first_name": "-first_name",
            "last_name": "last_name",
            "-last_name": "-last_name",
            "cases_count": "cases_count",
            "-cases_count": "-cases_count",
            "created_at": "created_at",
            "-created_at": "-created_at",
        }

        if ordering in valid_orderings:
            if ordering in ["cases_count", "-cases_count"]:
                # For cases count ordering, add secondary sort by name
                if ordering == "cases_count":
                    queryset = queryset.order_by(
                        "cases_count", "last_name", "first_name"
                    )
                else:  # -cases_count
                    queryset = queryset.order_by(
                        "-cases_count", "last_name", "first_name"
                    )
            else:
                queryset = queryset.order_by(valid_orderings[ordering])
        else:
            # Default ordering
            queryset = queryset.order_by("last_name", "first_name")

        return queryset

    def get(self, request):
        """Export defendants data"""
        export_format = request.query_params.get("export_format", "csv").lower()

        # Comprehensive debug logging
        settings.LOGGER.info(f"=== EXPORT REQUEST DEBUG ===")
        settings.LOGGER.info(f"User: {request.user}")
        settings.LOGGER.info(f"Method: {request.method}")
        settings.LOGGER.info(f"Path: {request.path}")
        settings.LOGGER.info(f"Full URL: {request.build_absolute_uri()}")
        settings.LOGGER.info(f"Format: {export_format}")
        settings.LOGGER.info(f"Query params: {dict(request.query_params)}")
        settings.LOGGER.info(f"Headers: {dict(request.headers)}")
        settings.LOGGER.info(f"Content type: {request.content_type}")
        settings.LOGGER.info(f"=== END DEBUG ===")

        if export_format not in ["csv", "json"]:
            return Response(
                {"error": "Invalid format. Supported formats: csv, json"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            queryset = self.get_queryset()

            # Check if dataset is too large (safety limit)
            max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
            total_count = queryset.count()

            if total_count > max_export_limit:
                return Response(
                    {
                        "error": f"Dataset too large for export. Maximum {max_export_limit} records allowed.",
                        "total_count": total_count,
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            # Use streaming response for large datasets
            if total_count > 1000:
                if export_format == "csv":
                    return self._stream_csv_response(queryset)
                else:
                    return self._stream_json_response(queryset)
            else:
                # Regular response for smaller datasets
                if export_format == "csv":
                    return self._csv_response(queryset)
                else:
                    return self._json_response(queryset)

        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            return Response(
                {"error": "Export failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "ID",
                "First Name",
                "Last Name",
                "Full Name",
                "Cases Count",
                "Created At",
                "Updated At",
            ]
        )

        # Write data
        for defendant in queryset:
            writer.writerow(
                [
                    defendant.id,
                    defendant.first_name or "",
                    defendant.last_name,
                    defendant.full_name,
                    defendant.cases_count,
                    defendant.created_at.isoformat() if defendant.created_at else "",
                    defendant.updated_at.isoformat() if defendant.updated_at else "",
                ]
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="defendants_export.csv"'

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} defendants as CSV"
        )
        return response

    def _json_response(self, queryset):
        """Generate JSON response for smaller datasets"""
        serializer = DefendantTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="defendants_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} defendants as JSON"
        )
        return response

    def _stream_csv_response(self, queryset):
        """Generate streaming CSV response for large datasets"""

        def csv_generator():
            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(
                [
                    "ID",
                    "First Name",
                    "Last Name",
                    "Full Name",
                    "Cases Count",
                    "Created At",
                    "Updated At",
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            # Write data in chunks
            chunk_size = 100
            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                for defendant in chunk:
                    writer.writerow(
                        [
                            defendant.id,
                            defendant.first_name or "",
                            defendant.last_name,
                            defendant.full_name,
                            defendant.cases_count,
                            (
                                defendant.created_at.isoformat()
                                if defendant.created_at
                                else ""
                            ),
                            (
                                defendant.updated_at.isoformat()
                                if defendant.updated_at
                                else ""
                            ),
                        ]
                    )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="defendants_export.csv"'

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} defendants as CSV"
        )
        return response

    def _stream_json_response(self, queryset):
        """Generate streaming JSON response for large datasets"""

        def json_generator():
            yield '{"count": ' + str(queryset.count()) + ', "results": ['

            chunk_size = 100
            first_chunk = True

            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                serializer = DefendantTinySerializer(chunk, many=True)

                for j, item in enumerate(serializer.data):
                    if not first_chunk or j > 0:
                        yield ","
                    yield json.dumps(item)
                    first_chunk = False

            yield "]}"

        response = StreamingHttpResponse(
            json_generator(), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="defendants_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} defendants as JSON"
        )
        return response
