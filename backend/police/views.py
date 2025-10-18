from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    HTTP_500_INTERNAL_SERVER_ERROR,
)
from django.db.models import Q, Count, Case, When, IntegerField
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
import csv
import json
import io
import logging

logger = logging.getLogger(__name__)

from .models import PoliceStation, PoliceOfficer
from .serializers import (
    PoliceStationSerializer,
    PoliceStationTinySerializer,
    PoliceOfficerSerializer,
    PoliceOfficerTinySerializer,
    PoliceOfficerCreateSerializer,
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
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get("full") == "true":
                return PoliceStationSerializer
            return PoliceStationTinySerializer
        return PoliceStationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

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
        }

        if ordering in valid_orderings:
            if "officer_count" in ordering:
                # For officer count ordering, we need to annotate the count
                from django.db.models import Count

                queryset = queryset.annotate(officers_count=Count("officers"))
                if ordering == "officer_count":
                    queryset = queryset.order_by(
                        "officers_count", "name"
                    )  # Secondary sort by name
                else:  # -officer_count
                    queryset = queryset.order_by("-officers_count", "name")
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
    permission_classes = [IsAuthenticated]

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


# endregion


# ============================================================================
# region POLICE OFFICER VIEWS
# ============================================================================


class PoliceOfficerListView(ListCreateAPIView):
    """
    GET: List all police officers with search/filtering
    POST: Create new police officer
    """

    queryset = PoliceOfficer.objects.all().select_related("station")
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PoliceOfficerCreateSerializer
        elif self.request.method == "GET":
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get("full") == "true":
                return PoliceOfficerSerializer
            return PoliceOfficerTinySerializer
        return PoliceOfficerSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(badge_number__icontains=search)
                | Q(station__name__icontains=search)
            )

        # Filter by rank
        rank = self.request.query_params.get("rank")
        if rank:
            queryset = queryset.filter(rank=rank)

        # Filter by sworn/unsworn officers
        is_sworn = self.request.query_params.get("is_sworn")
        if is_sworn is not None:
            sworn_ranks = [
                PoliceOfficer.SeniorityChoices.SWORN_OFFICER,
                PoliceOfficer.SeniorityChoices.CONSTABLE,
                PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE,
                PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE,
                PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
                PoliceOfficer.SeniorityChoices.DETECTIVE,
                PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE,
                PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE,
                PoliceOfficer.SeniorityChoices.SENIOR_DETECTIVE,
                PoliceOfficer.SeniorityChoices.SERGEANT,
                PoliceOfficer.SeniorityChoices.INSPECTOR,
            ]
            if is_sworn.lower() == "true":
                queryset = queryset.filter(rank__in=sworn_ranks)
            else:
                queryset = queryset.exclude(rank__in=sworn_ranks)

        # Filter by station
        station_id = self.request.query_params.get("station")
        if station_id:
            queryset = queryset.filter(station_id=station_id)

        # Filter officers without stations
        no_station = self.request.query_params.get("no_station")
        if no_station is not None and no_station.lower() == "true":
            queryset = queryset.filter(station__isnull=True)

        # Filter unknown/other ranks based on parameters
        include_unknown = self.request.query_params.get("include_unknown", "true")
        unknown_only = self.request.query_params.get("unknown_only", "false")

        if unknown_only.lower() == "true":
            # Show ONLY unknown/other ranks (for data quality review)
            queryset = queryset.filter(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )
        elif include_unknown.lower() == "false":
            # Exclude unknown/other ranks (normal filtering)
            queryset = queryset.exclude(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )

        # Dynamic ordering with rank seniority support
        ordering = self.request.query_params.get("ordering", "last_name")

        # Define rank seniority order (higher number = higher rank)
        rank_seniority_order = {
            PoliceOfficer.SeniorityChoices.UNKNOWN: 0,
            PoliceOfficer.SeniorityChoices.OTHER: 1,
            PoliceOfficer.SeniorityChoices.UNSWORN_OFFICER: 2,
            PoliceOfficer.SeniorityChoices.SWORN_OFFICER: 3,
            PoliceOfficer.SeniorityChoices.CONSTABLE: 4,
            PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE: 5,
            PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE: 6,
            PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE: 7,
            PoliceOfficer.SeniorityChoices.DETECTIVE: 8,
            PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE: 9,
            PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE: 10,
            PoliceOfficer.SeniorityChoices.SENIOR_DETECTIVE: 11,
            PoliceOfficer.SeniorityChoices.SERGEANT: 12,
            PoliceOfficer.SeniorityChoices.INSPECTOR: 13,
        }

        # Valid ordering fields
        valid_orderings = {
            "last_name": "last_name",
            "-last_name": "-last_name",
            "first_name": "first_name",
            "-first_name": "-first_name",
            "station": "station__name",
            "-station": "-station__name",
            "rank": "rank_seniority",  # Special handling needed
            "-rank": "-rank_seniority",  # Special handling needed
        }

        if ordering in valid_orderings:
            if "rank" in ordering:
                # For rank ordering, we need to use CASE/WHEN to order by seniority
                from django.db.models import Case, When, IntegerField

                # Create CASE/WHEN for rank seniority
                rank_cases = [
                    When(rank=rank, then=seniority)
                    for rank, seniority in rank_seniority_order.items()
                ]

                queryset = queryset.annotate(
                    rank_seniority=Case(
                        *rank_cases, default=0, output_field=IntegerField()
                    )
                )

                if ordering == "rank":
                    # Ascending: lowest rank first, then by name
                    queryset = queryset.order_by(
                        "rank_seniority", "last_name", "first_name"
                    )
                else:  # -rank
                    # Descending: highest rank first, then by name
                    queryset = queryset.order_by(
                        "-rank_seniority", "last_name", "first_name"
                    )
            else:
                # Standard field ordering with secondary sort by name
                primary_order = valid_orderings[ordering]
                if ordering.startswith("-"):
                    queryset = queryset.order_by(
                        primary_order, "last_name", "first_name"
                    )
                else:
                    queryset = queryset.order_by(
                        primary_order, "last_name", "first_name"
                    )
        else:
            # Default ordering
            queryset = queryset.order_by("last_name", "first_name")

        return queryset

    def perform_create(self, serializer):
        officer = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} created police officer: {officer}"
        )


class PoliceOfficerDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve police officer details
    PUT/PATCH: Update police officer
    DELETE: Delete police officer
    """

    queryset = PoliceOfficer.objects.all().select_related("station")
    serializer_class = PoliceOfficerSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} updated police officer: {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        settings.LOGGER.warning(
            f"User {self.request.user} deleted police officer: {instance}"
        )
        super().perform_destroy(instance)


class PoliceStationExportView(APIView):
    """
    Export police stations data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [IsAuthenticated]

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
        logger.info(f"=== POLICE STATIONS EXPORT REQUEST DEBUG ===")
        logger.info(f"User: {request.user}")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Full URL: {request.build_absolute_uri()}")
        logger.info(f"Format: {export_format}")
        logger.info(f"Query params: {dict(request.query_params)}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Content type: {request.content_type}")
        logger.info(f"=== END DEBUG ===")

        if export_format not in ["csv", "json"]:
            return Response(
                {"error": "Invalid format. Supported formats: csv, json"},
                status=HTTP_400_BAD_REQUEST,
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

        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            return Response(
                {"error": "Export failed. Please try again."},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )

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


class PoliceOfficerExportView(APIView):
    """
    Export police officers data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get filtered queryset for export"""
        queryset = PoliceOfficer.objects.select_related("station").order_by(
            "last_name", "first_name"
        )

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(badge_number__icontains=search)
            )

        # Filter by station
        station = self.request.query_params.get("station")
        if station and station != "all":
            if station == "none":
                queryset = queryset.filter(station__isnull=True)
            else:
                try:
                    station_id = int(station)
                    queryset = queryset.filter(station_id=station_id)
                except (ValueError, TypeError):
                    pass

        # Filter by rank
        rank = self.request.query_params.get("rank")
        if rank and rank != "all":
            queryset = queryset.filter(rank=rank)

        # Filter by sworn status
        sworn = self.request.query_params.get("sworn")
        if sworn and sworn != "all":
            queryset = queryset.filter(is_sworn=sworn.lower() == "true")

        # Filter unknown/other ranks based on parameters
        include_unknown = self.request.query_params.get("include_unknown", "true")
        unknown_only = self.request.query_params.get("unknown_only", "false")

        if unknown_only.lower() == "true":
            # Show ONLY unknown/other ranks (for data quality review)
            queryset = queryset.filter(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )
        elif include_unknown.lower() == "false":
            # Exclude unknown/other ranks (normal filtering)
            queryset = queryset.exclude(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )

        # Dynamic ordering with rank seniority support
        ordering = self.request.query_params.get("ordering", "last_name")

        # Define rank seniority order (higher number = higher rank)
        rank_seniority_order = {
            PoliceOfficer.SeniorityChoices.UNKNOWN: 0,
            PoliceOfficer.SeniorityChoices.OTHER: 1,
            PoliceOfficer.SeniorityChoices.UNSWORN_OFFICER: 2,
            PoliceOfficer.SeniorityChoices.SWORN_OFFICER: 3,
            PoliceOfficer.SeniorityChoices.CONSTABLE: 4,
            PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE: 5,
            PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE: 6,
            PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE: 7,
            PoliceOfficer.SeniorityChoices.DETECTIVE: 8,
            PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE: 9,
            PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE: 10,
            PoliceOfficer.SeniorityChoices.SENIOR_DETECTIVE: 11,
            PoliceOfficer.SeniorityChoices.SERGEANT: 12,
            PoliceOfficer.SeniorityChoices.INSPECTOR: 13,
        }

        # Valid ordering fields
        valid_orderings = {
            "last_name": "last_name",
            "-last_name": "-last_name",
            "first_name": "first_name",
            "-first_name": "-first_name",
            "station": "station__name",
            "-station": "-station__name",
            "rank": "rank_seniority",  # Special handling needed
            "-rank": "-rank_seniority",  # Special handling needed
        }

        if ordering in valid_orderings:
            if "rank" in ordering:
                # For rank ordering, we need to use CASE/WHEN to order by seniority
                rank_cases = [
                    When(rank=rank, then=seniority)
                    for rank, seniority in rank_seniority_order.items()
                ]

                queryset = queryset.annotate(
                    rank_seniority=Case(
                        *rank_cases, default=0, output_field=IntegerField()
                    )
                )

                if ordering == "rank":
                    # Ascending: lowest rank first, then by name
                    queryset = queryset.order_by(
                        "rank_seniority", "last_name", "first_name"
                    )
                else:  # -rank
                    # Descending: highest rank first, then by name
                    queryset = queryset.order_by(
                        "-rank_seniority", "last_name", "first_name"
                    )
            else:
                # Standard field ordering with secondary sort by name
                primary_order = valid_orderings[ordering]
                if ordering.startswith("-"):
                    queryset = queryset.order_by(
                        primary_order, "last_name", "first_name"
                    )
                else:
                    queryset = queryset.order_by(
                        primary_order, "last_name", "first_name"
                    )
        else:
            # Default ordering
            queryset = queryset.order_by("last_name", "first_name")

        return queryset

    def get(self, request):
        """Export police officers data"""
        export_format = request.query_params.get("export_format", "csv").lower()

        # Comprehensive debug logging
        logger.info(f"=== POLICE OFFICERS EXPORT REQUEST DEBUG ===")
        logger.info(f"User: {request.user}")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Full URL: {request.build_absolute_uri()}")
        logger.info(f"Format: {export_format}")
        logger.info(f"Query params: {dict(request.query_params)}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Content type: {request.content_type}")
        logger.info(f"=== END DEBUG ===")

        if export_format not in ["csv", "json"]:
            return Response(
                {"error": "Invalid format. Supported formats: csv, json"},
                status=HTTP_400_BAD_REQUEST,
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

        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            return Response(
                {"error": "Export failed. Please try again."},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "ID",
                "Badge Number",
                "First Name",
                "Last Name",
                "Full Name",
                "Rank",
                "Rank Display",
                "Station Name",
                "Is Sworn",
                "Created At",
                "Updated At",
            ]
        )

        # Write data
        for officer in queryset:
            writer.writerow(
                [
                    officer.id,
                    officer.badge_number or "",
                    officer.first_name or "",
                    officer.last_name or "",
                    officer.full_name,
                    officer.rank,
                    officer.get_rank_display(),
                    officer.station.name if officer.station else "",
                    officer.is_sworn,
                    officer.created_at.isoformat() if officer.created_at else "",
                    officer.updated_at.isoformat() if officer.updated_at else "",
                ]
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="police_officers_export.csv"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} police officers as CSV"
        )
        return response

    def _json_response(self, queryset):
        """Generate JSON response for smaller datasets"""
        serializer = PoliceOfficerTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="police_officers_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} police officers as JSON"
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
                    "Badge Number",
                    "First Name",
                    "Last Name",
                    "Full Name",
                    "Rank",
                    "Rank Display",
                    "Station Name",
                    "Is Sworn",
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
                for officer in chunk:
                    writer.writerow(
                        [
                            officer.id,
                            officer.badge_number or "",
                            officer.first_name or "",
                            officer.last_name or "",
                            officer.full_name,
                            officer.rank,
                            officer.get_rank_display(),
                            officer.station.name if officer.station else "",
                            officer.is_sworn,
                            (
                                officer.created_at.isoformat()
                                if officer.created_at
                                else ""
                            ),
                            (
                                officer.updated_at.isoformat()
                                if officer.updated_at
                                else ""
                            ),
                        ]
                    )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="police_officers_export.csv"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} police officers as CSV"
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
                serializer = PoliceOfficerTinySerializer(chunk, many=True)

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
            'attachment; filename="police_officers_export.json"'
        )

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} police officers as JSON"
        )
        return response


# endregion
