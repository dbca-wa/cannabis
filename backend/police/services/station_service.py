"""Service layer for police station operations."""

import logging

from django.db import transaction
from django.db.models import Count, Q
from rest_framework.exceptions import NotFound, ValidationError

from ..models import PoliceOfficer, PoliceStation

logger = logging.getLogger(__name__)


class StationService:
    """Business logic for police station operations."""

    @staticmethod
    def get_station(pk):
        """Retrieve a police station by primary key.

        Raises:
            NotFound: If station does not exist.
        """
        try:
            return PoliceStation.objects.get(pk=pk)
        except PoliceStation.DoesNotExist:
            raise NotFound(f"Police station with pk {pk} not found")

    @staticmethod
    def get_filtered_queryset(params):
        """Build a filtered and ordered queryset from query parameters.

        Args:
            params: Dict-like object of query parameters.

        Returns:
            QuerySet: Filtered, annotated, and ordered queryset.
        """
        queryset = PoliceStation.objects.all().order_by("name")

        # Annotate with case count
        queryset = queryset.annotate(
            case_count=Count("case_involvement", distinct=True)
        )

        # Search by name or address
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(address__icontains=search)
            )

        # Filter by stations with/without officers
        has_officers = params.get("has_officers")
        if has_officers is not None:
            if has_officers.lower() == "true":
                queryset = queryset.filter(officers__isnull=False).distinct()
            else:
                queryset = queryset.filter(officers__isnull=True)

        # Apply ordering
        queryset = StationService._apply_ordering(queryset, params)

        return queryset

    @staticmethod
    def get_export_queryset(params):
        """Build a queryset for station data export.

        Args:
            params: Dict-like object of query parameters.

        Returns:
            QuerySet: Filtered and ordered queryset with officer_count.
        """
        queryset = PoliceStation.objects.annotate(
            officer_count=Count("officers")
        ).order_by("name")

        # Search
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(address__icontains=search)
            )

        # Apply ordering
        ordering = params.get("ordering", "name")
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

    @staticmethod
    @transaction.atomic
    def merge_stations(primary_id, secondary_ids):
        """Merge secondary stations into a primary station.

        Transfers all officers and cases from secondary stations to the
        primary station, then deletes secondary stations.

        Args:
            primary_id: PK of the station to merge into.
            secondary_ids: List of PKs to merge away.

        Returns:
            dict: Merge result with reassignment counts.

        Raises:
            ValidationError: If input is invalid.
            NotFound: If any station does not exist.
        """
        from cases.models import Submission

        if not primary_id:
            raise ValidationError("primary_id is required.")

        if (
            not secondary_ids
            or not isinstance(secondary_ids, list)
            or len(secondary_ids) == 0
        ):
            raise ValidationError("At least one secondary_id is required.")

        if primary_id in secondary_ids:
            raise ValidationError("primary_id cannot appear in secondary_ids.")

        # Verify all stations exist
        all_ids = [primary_id] + secondary_ids
        existing = PoliceStation.objects.filter(pk__in=all_ids).values_list(
            "pk", flat=True
        )
        missing = set(all_ids) - set(existing)
        if missing:
            raise NotFound(f"Station(s) not found: {sorted(missing)}")

        primary = PoliceStation.objects.get(pk=primary_id)
        officers_reassigned = 0
        cases_reassigned = 0

        for secondary_id in secondary_ids:
            secondary = PoliceStation.objects.get(pk=secondary_id)

            # Transfer officers to primary station
            officer_count = PoliceOfficer.objects.filter(station=secondary).update(
                station=primary
            )
            officers_reassigned += officer_count

            # Transfer cases to primary station
            case_count = Submission.objects.filter(station=secondary).update(
                station=primary
            )
            cases_reassigned += case_count

            secondary.delete()

        return {
            "primary_id": primary_id,
            "primary_name": primary.name,
            "officers_reassigned": officers_reassigned,
            "cases_reassigned": cases_reassigned,
        }

    @staticmethod
    def _apply_ordering(queryset, params):
        """Apply dynamic ordering to the station queryset."""
        ordering = params.get("ordering", "name")

        valid_orderings = {
            "name": "name",
            "-name": "-name",
            "officer_count": "officers__count",
            "-officer_count": "-officers__count",
            "case_count": "case_count",
            "-case_count": "-case_count",
        }

        if ordering in valid_orderings:
            if "officer_count" in ordering:
                queryset = queryset.annotate(officers_count=Count("officers"))
                if ordering == "officer_count":
                    queryset = queryset.order_by("officers_count", "name")
                else:
                    queryset = queryset.order_by("-officers_count", "name")
            elif "case_count" in ordering:
                queryset = queryset.order_by(valid_orderings[ordering], "name")
            else:
                queryset = queryset.order_by(valid_orderings[ordering])
        else:
            queryset = queryset.order_by("name")

        return queryset
