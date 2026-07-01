import csv
import io
import json
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_413_REQUEST_ENTITY_TOO_LARGE,
)
from rest_framework.views import APIView

from users.permissions import HasAppAccess

logger = logging.getLogger(__name__)

from cases.models import Submission  # noqa: E402

from ..models import PoliceOfficer, PoliceStation  # noqa: E402
from ..serializers import (  # noqa: E402
    PoliceStationSerializer,
    PoliceStationTinySerializer,
)

# ============================================================================
# region POLICE STATION VIEWS
# ============================================================================


class PoliceStationListView(ListCreateAPIView):
    """
    GET: List all police stations with search/filtering
    POST: Create new police station
    """

    queryset = PoliceStation.objects.all().order_by("name")
    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        if self.request.method == "GET":
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get("full") == "true":
                return PoliceStationSerializer
            return PoliceStationTinySerializer
        return PoliceStationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Annotate with case count (submissions linked to this station)
        queryset = queryset.annotate(
            case_count=Count("case_involvement", distinct=True)
        )

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(address__icontains=search)
            )

        # Filter by stations with officers
        has_officers = self.request.query_params.get("has_officers")
        if has_officers is not None:
            if has_officers.lower() == "true":
                queryset = queryset.filter(officers__isnull=False).distinct()
            else:
                queryset = queryset.filter(officers__isnull=True)

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "name")

        # Validate ordering field and handle officer_count specially
        valid_orderings = {
            "name": "name",
            "-name": "-name",
            "officer_count": "officers__count",  # Use annotation for counting
            "-officer_count": "-officers__count",
            "case_count": "case_count",
            "-case_count": "-case_count",
        }

        if ordering in valid_orderings:
            if "officer_count" in ordering:
                # For officer count ordering, we need to annotate the count
                queryset = queryset.annotate(officers_count=Count("officers"))
                if ordering == "officer_count":
                    queryset = queryset.order_by(
                        "officers_count", "name"
                    )  # Secondary sort by name
                else:  # -officer_count
                    queryset = queryset.order_by("-officers_count", "name")
            elif "case_count" in ordering:
                # For case count ordering, add secondary sort by name
                queryset = queryset.order_by(valid_orderings[ordering], "name")
            else:
                queryset = queryset.order_by(valid_orderings[ordering])
        else:
            # Default ordering
            queryset = queryset.order_by("name")

        return queryset

    def perform_create(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} created police station: {serializer.validated_data['name']}"
        )
        serializer.save()


class PoliceStationDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve police station details
    PUT/PATCH: Update police station
    DELETE: Delete police station
    """

    queryset = PoliceStation.objects.all()
    serializer_class = PoliceStationSerializer
    permission_classes = [HasAppAccess]

    def perform_update(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} updated police station: {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        settings.LOGGER.warning(
            f"User {self.request.user} deleted police station: {instance}"
        )
        super().perform_destroy(instance)


class PoliceStationExportView(APIView):
    """
    Export police stations data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [HasAppAccess]

    def get_queryset(self):
        """Get filtered queryset for export"""
        queryset = PoliceStation.objects.annotate(
            officer_count=Count("officers")
        ).order_by("name")

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(address__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "name")
        valid_orderings = {
            "name": "name",
            "-name": "-name",
            "address": "address",
            "-address": "-address",
            "officer_count": "officer_count",
            "-officer_count": "-officer_count",
        }

        if ordering in valid_orderings:
            queryset = queryset.order_by(valid_orderings[ordering])

        return queryset

    def get(self, request):
        """Export police stations data"""
        export_format = request.query_params.get("export_format", "csv").lower()

        # Comprehensive debug logging
        logger.info("=== POLICE STATIONS EXPORT REQUEST DEBUG ===")
        logger.info(f"User: {request.user}")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Full URL: {request.build_absolute_uri()}")
        logger.info(f"Format: {export_format}")
        logger.info(f"Query params: {dict(request.query_params)}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Content type: {request.content_type}")
        logger.info("=== END DEBUG ===")

        if export_format not in ["csv", "json"]:
            raise ValidationError(
                {"detail": "Invalid format. Supported formats: csv, json"}
            )

        try:
            queryset = self.get_queryset()

            # Check if dataset is too large (safety limit)
            max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
            total_count = queryset.count()

            if total_count > max_export_limit:
                return Response(
                    {
                        "detail": f"Dataset too large for export. Maximum {max_export_limit} records allowed.",
                        "total_count": total_count,
                    },
                    status=HTTP_413_REQUEST_ENTITY_TOO_LARGE,
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

        except ValidationError:
            raise
        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            raise

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "ID",
                "Name",
                "Address",
                "Phone",
                "Officer Count",
                "Created At",
                "Updated At",
            ]
        )

        # Write data
        for station in queryset:
            writer.writerow(
                [
                    station.id,
                    station.name,
                    station.address or "",
                    station.phone or "",
                    station.officer_count,
                    station.created_at.isoformat() if station.created_at else "",
                    station.updated_at.isoformat() if station.updated_at else "",
                ]
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="police_stations_export.csv"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} police stations as CSV"
        )
        return response

    def _json_response(self, queryset):
        """Generate JSON response for smaller datasets"""
        serializer = PoliceStationTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="police_stations_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} police stations as JSON"
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
                    "Name",
                    "Address",
                    "Phone",
                    "Officer Count",
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
                for station in chunk:
                    writer.writerow(
                        [
                            station.id,
                            station.name,
                            station.address or "",
                            station.phone or "",
                            station.officer_count,
                            (
                                station.created_at.isoformat()
                                if station.created_at
                                else ""
                            ),
                            (
                                station.updated_at.isoformat()
                                if station.updated_at
                                else ""
                            ),
                        ]
                    )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="police_stations_export.csv"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} police stations as CSV"
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
                serializer = PoliceStationTinySerializer(chunk, many=True)

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
            'attachment; filename="police_stations_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} police stations as JSON"
        )
        return response


class StationMergeView(APIView):
    """Merge multiple police stations into a single primary station."""

    permission_classes = [HasAppAccess]

    def post(self, request):
        primary_id = request.data.get("primary_id")
        secondary_ids = request.data.get("secondary_ids")

        # Validation
        if not primary_id:
            return Response(
                {"error": "primary_id is required."},
                status=HTTP_400_BAD_REQUEST,
            )

        if (
            not secondary_ids
            or not isinstance(secondary_ids, list)
            or len(secondary_ids) == 0
        ):
            return Response(
                {"error": "At least one secondary_id is required."},
                status=HTTP_400_BAD_REQUEST,
            )

        if primary_id in secondary_ids:
            return Response(
                {"error": "primary_id cannot appear in secondary_ids."},
                status=HTTP_400_BAD_REQUEST,
            )

        # Verify all stations exist
        all_ids = [primary_id] + secondary_ids
        existing = PoliceStation.objects.filter(pk__in=all_ids).values_list(
            "pk", flat=True
        )
        missing = set(all_ids) - set(existing)
        if missing:
            return Response(
                {"error": f"Station(s) not found: {sorted(missing)}"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Perform atomic merge
        officers_reassigned = 0
        cases_reassigned = 0
        with transaction.atomic():
            primary = PoliceStation.objects.get(pk=primary_id)

            for secondary_id in secondary_ids:
                secondary = PoliceStation.objects.get(pk=secondary_id)

                # Transfer officers to the primary station
                officer_count = PoliceOfficer.objects.filter(station=secondary).update(
                    station=primary
                )
                officers_reassigned += officer_count

                # Transfer cases (submissions) to the primary station
                case_count = Submission.objects.filter(station=secondary).update(
                    station=primary
                )
                cases_reassigned += case_count

                secondary.delete()

        settings.LOGGER.info(
            f"User {request.user} merged stations {secondary_ids} into "
            f"'{primary.name}' (id={primary_id}). "
            f"Reassigned {officers_reassigned} officers and {cases_reassigned} cases."
        )

        return Response(
            {
                "message": "Merge completed successfully.",
                "primary_id": primary_id,
                "officers_reassigned": officers_reassigned,
                "cases_reassigned": cases_reassigned,
            },
            status=HTTP_200_OK,
        )


# endregion
