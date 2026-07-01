"""Service layer for police officer operations."""

import logging

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, When
from rest_framework.exceptions import NotFound, ValidationError

from ..models import PoliceOfficer

logger = logging.getLogger(__name__)

# Rank seniority order (higher number = higher rank)
RANK_SENIORITY_ORDER = {
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

# Sworn rank values for filtering
SWORN_RANKS = [
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


class OfficerService:
    """Business logic for police officer operations."""

    @staticmethod
    def get_officer(pk):
        """Retrieve a police officer by primary key.

        Raises:
            NotFound: If officer does not exist.
        """
        try:
            return PoliceOfficer.objects.select_related("station").get(pk=pk)
        except PoliceOfficer.DoesNotExist:
            raise NotFound(f"Police officer with pk {pk} not found")

    @staticmethod
    def get_filtered_queryset(params):
        """Build a filtered and ordered queryset from query parameters.

        Args:
            params: Dict-like object of query parameters (e.g. request.query_params).

        Returns:
            QuerySet: Filtered, annotated, and ordered queryset.
        """
        queryset = PoliceOfficer.objects.select_related("station")

        # Annotate with case count
        queryset = queryset.annotate(
            case_count=Count("cases_made", distinct=True)
            + Count("cases_requested", distinct=True)
        )

        # Multi-word search across name, badge, and station
        search = params.get("search")
        if search:
            search_terms = search.strip().split()
            for term in search_terms:
                queryset = queryset.filter(
                    Q(given_names__icontains=term)
                    | Q(last_name__icontains=term)
                    | Q(badge_number__icontains=term)
                    | Q(station__name__icontains=term)
                )

        # Filter by rank
        rank = params.get("rank")
        if rank:
            queryset = queryset.filter(rank=rank)

        # Filter by sworn/unsworn status
        is_sworn = params.get("is_sworn")
        if is_sworn is not None:
            if is_sworn.lower() == "true":
                queryset = queryset.filter(rank__in=SWORN_RANKS)
            else:
                queryset = queryset.exclude(rank__in=SWORN_RANKS)

        # Filter by station
        station_id = params.get("station")
        if station_id:
            queryset = queryset.filter(station_id=station_id)

        # Filter officers without stations
        no_station = params.get("no_station")
        if no_station is not None and no_station.lower() == "true":
            queryset = queryset.filter(station__isnull=True)

        # Filter unknown/other ranks
        include_unknown = params.get("include_unknown", "true")
        unknown_only = params.get("unknown_only", "false")

        if unknown_only.lower() == "true":
            queryset = queryset.filter(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )
        elif include_unknown.lower() == "false":
            queryset = queryset.exclude(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )

        # Apply ordering
        queryset = OfficerService._apply_ordering(queryset, params)

        return queryset

    @staticmethod
    def get_export_queryset(params):
        """Build a queryset for officer data export.

        Similar to get_filtered_queryset but without case_count annotation
        and with simpler search (no station search for export).

        Args:
            params: Dict-like object of query parameters.

        Returns:
            QuerySet: Filtered and ordered queryset for export.
        """
        queryset = PoliceOfficer.objects.select_related("station").order_by(
            "last_name", "given_names"
        )

        # Search
        search = params.get("search")
        if search:
            search_terms = search.strip().split()
            for term in search_terms:
                queryset = queryset.filter(
                    Q(given_names__icontains=term)
                    | Q(last_name__icontains=term)
                    | Q(badge_number__icontains=term)
                )

        # Filter by station
        station = params.get("station")
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
        rank = params.get("rank")
        if rank and rank != "all":
            queryset = queryset.filter(rank=rank)

        # Filter by sworn status
        sworn = params.get("sworn")
        if sworn and sworn != "all":
            queryset = queryset.filter(is_sworn=sworn.lower() == "true")

        # Filter unknown/other ranks
        include_unknown = params.get("include_unknown", "true")
        unknown_only = params.get("unknown_only", "false")

        if unknown_only.lower() == "true":
            queryset = queryset.filter(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )
        elif include_unknown.lower() == "false":
            queryset = queryset.exclude(
                rank__in=[
                    PoliceOfficer.SeniorityChoices.UNKNOWN,
                    PoliceOfficer.SeniorityChoices.OTHER,
                ]
            )

        # Apply ordering
        queryset = OfficerService._apply_export_ordering(queryset, params)

        return queryset

    @staticmethod
    @transaction.atomic
    def merge_officers(source_id, target_id):
        """Merge source officer into target officer.

        Reassigns all cases from source to target, then deletes source.

        Args:
            source_id: PK of the officer to merge away.
            target_id: PK of the officer to merge into.

        Returns:
            dict: Merge result with target info and reassignment count.

        Raises:
            ValidationError: If IDs are missing or identical.
            NotFound: If either officer does not exist.
        """
        from cases.models import Case as CaseModel

        if not source_id or not target_id:
            raise ValidationError(
                "Both source_officer_id and target_officer_id are required."
            )

        if int(source_id) == int(target_id):
            raise ValidationError("Cannot merge an officer into itself.")

        try:
            source = PoliceOfficer.objects.get(pk=source_id)
        except PoliceOfficer.DoesNotExist:
            raise NotFound(f"Source officer with pk {source_id} not found")

        try:
            target = PoliceOfficer.objects.get(pk=target_id)
        except PoliceOfficer.DoesNotExist:
            raise NotFound(f"Target officer with pk {target_id} not found")

        # Reassign cases where source is submitting officer
        sub_count = CaseModel.objects.filter(submitting_officer=source).update(
            submitting_officer=target
        )

        # Reassign cases where source is requesting officer
        req_count = CaseModel.objects.filter(requesting_officer=source).update(
            requesting_officer=target
        )

        source_name = source.full_name
        source.delete()

        return {
            "merged_into": target.id,
            "target_name": target.full_name,
            "source_name": source_name,
            "cases_reassigned": sub_count + req_count,
        }

    @staticmethod
    def _apply_ordering(queryset, params):
        """Apply dynamic ordering to the officer queryset.

        Supports rank seniority ordering via CASE/WHEN annotation.
        """
        ordering = params.get("ordering", "last_name")

        valid_orderings = {
            "last_name": "last_name",
            "-last_name": "-last_name",
            "given_names": "given_names",
            "-given_names": "-given_names",
            "station": "station__name",
            "-station": "-station__name",
            "rank": "rank_seniority",
            "-rank": "-rank_seniority",
            "case_count": "case_count",
            "-case_count": "-case_count",
        }

        if ordering in valid_orderings:
            if "rank" in ordering:
                rank_cases = [
                    When(rank=rank, then=seniority)
                    for rank, seniority in RANK_SENIORITY_ORDER.items()
                ]
                queryset = queryset.annotate(
                    rank_seniority=Case(
                        *rank_cases, default=0, output_field=IntegerField()
                    )
                )
                if ordering == "rank":
                    queryset = queryset.order_by(
                        "rank_seniority", "last_name", "given_names"
                    )
                else:
                    queryset = queryset.order_by(
                        "-rank_seniority", "last_name", "given_names"
                    )
            elif "case_count" in ordering:
                queryset = queryset.order_by(
                    valid_orderings[ordering], "last_name", "given_names"
                )
            else:
                primary_order = valid_orderings[ordering]
                queryset = queryset.order_by(primary_order, "last_name", "given_names")
        else:
            queryset = queryset.order_by("last_name", "given_names")

        return queryset

    @staticmethod
    def _apply_export_ordering(queryset, params):
        """Apply ordering for export querysets (no case_count field)."""
        ordering = params.get("ordering", "last_name")

        valid_orderings = {
            "last_name": "last_name",
            "-last_name": "-last_name",
            "given_names": "given_names",
            "-given_names": "-given_names",
            "station": "station__name",
            "-station": "-station__name",
            "rank": "rank_seniority",
            "-rank": "-rank_seniority",
        }

        if ordering in valid_orderings:
            if "rank" in ordering:
                rank_cases = [
                    When(rank=rank, then=seniority)
                    for rank, seniority in RANK_SENIORITY_ORDER.items()
                ]
                queryset = queryset.annotate(
                    rank_seniority=Case(
                        *rank_cases, default=0, output_field=IntegerField()
                    )
                )
                if ordering == "rank":
                    queryset = queryset.order_by(
                        "rank_seniority", "last_name", "given_names"
                    )
                else:
                    queryset = queryset.order_by(
                        "-rank_seniority", "last_name", "given_names"
                    )
            else:
                primary_order = valid_orderings[ordering]
                queryset = queryset.order_by(primary_order, "last_name", "given_names")
        else:
            queryset = queryset.order_by("last_name", "given_names")

        return queryset
