from django.conf import settings
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

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
    "phase",
    "-phase",
} | _NULL_SAFE_ORDERINGS


def _apply_ordering(queryset, ordering):
    """Apply validated ordering with null-safe FK sorting."""
    if ordering not in VALID_ORDERINGS:
        return queryset.order_by("-received")

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
        queryset = queryset.filter(phase=phase)

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
            | Q(requesting_officer__first_name__icontains=search)
            | Q(requesting_officer__last_name__icontains=search)
            | Q(submitting_officer__first_name__icontains=search)
            | Q(submitting_officer__last_name__icontains=search)
            | Q(defendants__given_names__icontains=search)
            | Q(defendants__last_name__icontains=search)
        )
        if search.isdigit():
            search_q = search_q | Q(pk=int(search))
        queryset = queryset.filter(search_q).distinct()

    return queryset


class CaseListView(ListCreateAPIView):
    """
    GET: List cases with filtering and search
    POST: Create new case
    """

    permission_classes = [IsAuthenticated]

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
        ).prefetch_related("defendants", "bags", "certificates", "invoices")

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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Case.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
        ).prefetch_related(
            "defendants",
            "bags__assessment",
            "certificates",
            "invoices",
            "additional_fees",
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CaseUpdateSerializer
        return CaseSerializer

    def perform_update(self, serializer):
        old_phase = self.get_object().phase
        case = serializer.save()
        new_phase = case.phase

        # Log phase changes
        if old_phase != new_phase:
            settings.LOGGER.info(
                f"User {self.request.user} changed case {case.case_number} phase from {old_phase} to {new_phase}"
            )

            # Update workflow timestamps based on new phase
            now = timezone.now()
            if new_phase == Case.PhaseChoices.BOTANIST_SIGNOFF:
                case.botanist_approved_at = now
            elif new_phase == Case.PhaseChoices.COMPLETE:
                case.completed_at = now

            case.save(
                update_fields=[
                    "botanist_approved_at",
                    "completed_at",
                ]
            )

    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted case: {instance}")
        super().perform_destroy(instance)
