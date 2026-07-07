from django.conf import settings
from django.db.models import Case as CaseExpr
from django.db.models import F, IntegerField, Min, Q, Value, When
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case
from ..serializers import (
    CaseCreateSerializer,
    CaseListSerializer,
    CaseSerializer,
    CaseUpdateSerializer,
)

# Orderings that support null-safe sorting
_NULL_SAFE_ORDERINGS = {
    "approved_botanist__last_name",
    "-approved_botanist__last_name",
    "requesting_officer__last_name",
    "-requesting_officer__last_name",
    "submitting_officer__last_name",
    "-submitting_officer__last_name",
}

VALID_ORDERINGS = {
    "case_number",
    "-case_number",
    "received",
    "-received",
    "status_priority",
    "-status_priority",
} | _NULL_SAFE_ORDERINGS


# Phase priority for sorting: lower number = shown first in default order.
# Assessment (1) and Unsigned (2) are "active work" and appear at top.
# Batching (3) and In Batch (4) are transitional.
# Complete (5) is done. Legacy (6, via is_legacy flag) at the very bottom.
_PHASE_PRIORITY = {
    "assessment": 1,
    "unsigned_generation": 2,
    "batching": 3,
    "in_batch": 4,
    "complete": 5,
}


def _annotate_status_priority(queryset):
    """Annotate each case with a numeric priority based on its forms' phases.

    Uses the minimum phase priority across the case's forms (the least-advanced
    form drives the case's position). Legacy cases always sort last.
    """
    phase_when_clauses = [
        When(forms__phase=phase, then=Value(priority))
        for phase, priority in _PHASE_PRIORITY.items()
    ]
    return queryset.annotate(
        _form_priority=Min(
            CaseExpr(
                *phase_when_clauses,
                default=Value(99),
                output_field=IntegerField(),
            )
        ),
        status_priority=CaseExpr(
            When(is_legacy=True, then=Value(100)),
            default="_form_priority",
            output_field=IntegerField(),
        ),
    )


def _apply_ordering(queryset, ordering):
    """Apply validated ordering with null-safe FK sorting and status priority."""
    if ordering not in VALID_ORDERINGS:
        # Default: order by status priority (active cases first), then newest received
        return _annotate_status_priority(queryset).order_by(
            "status_priority", "-received"
        )

    if ordering in ("status_priority", "-status_priority"):
        qs = _annotate_status_priority(queryset)
        if ordering.startswith("-"):
            return qs.order_by("-status_priority", "-received")
        return qs.order_by("status_priority", "-received")

    if ordering in _NULL_SAFE_ORDERINGS:
        field = ordering.lstrip("-")
        if ordering.startswith("-"):
            return queryset.order_by(F(field).desc(nulls_last=True))
        return queryset.order_by(F(field).asc(nulls_last=True))

    return queryset.order_by(ordering)


def _apply_filters(queryset, params):
    """Apply query parameter filters to the case queryset."""
    phase = params.get("phase")
    if phase:
        # Cases with at least one form in the requested phase.
        queryset = queryset.filter(forms__phase=phase).distinct()

    botanist_id = params.get("botanist")
    if botanist_id:
        queryset = queryset.filter(approved_botanist_id=botanist_id)

    officer_id = params.get("officer")
    if officer_id:
        queryset = queryset.filter(
            Q(requesting_officer_id=officer_id) | Q(submitting_officer_id=officer_id)
        )

    station_id = params.get("station")
    if station_id:
        queryset = queryset.filter(station_id=station_id)

    date_from = params.get("date_from")
    if date_from:
        queryset = queryset.filter(received__gte=date_from)

    date_to = params.get("date_to")
    if date_to:
        queryset = queryset.filter(received__lte=date_to)

    search = params.get("search")
    if search:
        search_q = (
            Q(case_number__icontains=search)
            | Q(requesting_officer__given_names__icontains=search)
            | Q(requesting_officer__last_name__icontains=search)
            | Q(submitting_officer__given_names__icontains=search)
            | Q(submitting_officer__last_name__icontains=search)
            | Q(defendants__given_names__icontains=search)
            | Q(defendants__last_name__icontains=search)
        )
        if search.isdigit():
            search_q = search_q | Q(pk=int(search))
        queryset = queryset.filter(search_q).distinct()

    # Tag number search — filters cases whose forms have bags matching the tag
    tag_search = params.get("tag_search")
    if tag_search:
        queryset = queryset.filter(
            Q(forms__bags__seal_tag_numbers__icontains=tag_search)
            | Q(forms__bags__new_seal_tag_numbers__icontains=tag_search)
        ).distinct()

    return queryset


class CaseNumberCheckView(APIView):
    """
    GET: Check whether a police reference (case number) already exists.

    Query params:
      - case_number (required): the value to check
      - exclude_id (optional): a case pk to ignore (for editing an existing case)

    The comparison is case-insensitive and ignores leading/trailing whitespace,
    so a duplicate reference is always detected and never creates a second case.

    Returns: {"exists": bool, "case": {"id": int, "case_number": str} | null}
    """

    permission_classes = [HasAppAccess]

    def get(self, request):
        case_number = (request.query_params.get("case_number") or "").strip()

        if not case_number:
            return Response({"exists": False, "case": None})

        queryset = Case.objects.filter(case_number__iexact=case_number)

        exclude_id = request.query_params.get("exclude_id")
        if exclude_id:
            try:
                queryset = queryset.exclude(pk=int(exclude_id))
            except (ValueError, TypeError):
                pass

        match = queryset.first()
        if match is None:
            return Response({"exists": False, "case": None})

        return Response(
            {
                "exists": True,
                "case": {"id": match.id, "case_number": match.case_number},
            }
        )


class CaseListView(ListCreateAPIView):
    """
    GET: List cases with filtering and search
    POST: Create new case
    """

    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CaseCreateSerializer
        elif self.request.query_params.get("full") == "true":
            return CaseSerializer
        return CaseListSerializer

    def get_queryset(self):
        queryset = Case.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "requesting_officer__station",
            "submitting_officer",
            "submitting_officer__station",
            "station",
        ).prefetch_related("defendants", "forms__bags", "forms__certificate")

        queryset = _apply_filters(queryset, self.request.query_params)
        ordering = self.request.query_params.get("ordering", "-received")
        return _apply_ordering(queryset, ordering)

    def perform_create(self, serializer):
        user = self.request.user
        settings.LOGGER.info(f"User {user.email} creating a case")
        case = serializer.save()
        settings.LOGGER.info(f"User {user.email} created case: {case.case_number}")


class CaseDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve case details
    PUT/PATCH: Update case
    DELETE: Delete case
    """

    serializer_class = CaseSerializer
    permission_classes = [HasAppAccess]

    def get_queryset(self):
        return Case.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
        ).prefetch_related(
            "defendants",
            "forms__bags__assessment",
            "forms__certificate",
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CaseUpdateSerializer
        return CaseSerializer

    def perform_update(self, serializer):
        case_obj = self.get_object()
        # A fully-complete case is read-only for non-admins (server-side guard).
        from ..permissions import ensure_case_editable

        ensure_case_editable(case_obj, self.request.user)

        case = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated case {case.case_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted case: {instance}")
        super().perform_destroy(instance)
