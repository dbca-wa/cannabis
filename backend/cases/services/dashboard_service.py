"""Dashboard service — business logic for dashboard statistics and user cases.

Encapsulates queries for certificate stats, revenue stats, pending attention
items, and user-specific case lists used by dashboard widgets.
"""

from dateutil.relativedelta import relativedelta
from django.db.models import Count, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import Batch, Case, Certificate, DrugBag, Priority3Form

# Every workflow phase except Complete — the "active" phases. A case counts as
# active while it has at least one form in one of these phases.
ACTIVE_PHASES = [
    phase for phase in Case.PhaseChoices.values if phase != Case.PhaseChoices.COMPLETE
]


class DashboardService:
    """Business logic for dashboard views."""

    @staticmethod
    def get_my_cases(user):
        """Return active cases relevant to the user based on their role.

        Returns:
            A list of case dictionaries for the dashboard widget.
        """
        queryset = Case.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
        ).prefetch_related("defendants")

        if user.role == "botanist":
            queryset = queryset.filter(approved_botanist=user)
            role_in_submission = "botanist"
        elif user.role == "finance":
            queryset = queryset.filter(finance_officer=user)
            role_in_submission = "finance"
        elif user.is_staff:
            role_in_submission = "admin"
        else:
            queryset = queryset.filter(
                Q(approved_botanist=user) | Q(finance_officer=user)
            )
            role_in_submission = "user"

        # Active cases are those with at least one non-complete form.
        queryset = (
            queryset.filter(forms__phase__in=ACTIVE_PHASES)
            .distinct()
            .order_by("-received")[:10]
        )

        cases_data = []
        for case in queryset:
            status = case.derived_status
            cases_data.append(
                {
                    "id": case.id,
                    "case_number": case.case_number,
                    "phase": str(status),
                    "phase_display": Case.PhaseChoices(status).label,
                    "received": case.received.isoformat(),
                    "role_in_submission": role_in_submission,
                }
            )

        return {"results": cases_data, "count": len(cases_data)}

    @staticmethod
    def get_certificate_stats():
        """Compute certificate count stats with month-over-month and YoY comparisons.

        Returns:
            A dictionary with current_month, previous_month, and
            previous_year_same_month statistics.
        """
        now = timezone.now()
        current_month_start = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        current_count = Certificate.objects.filter(
            created_at__gte=current_month_start
        ).count()

        prev_month_start = current_month_start - relativedelta(months=1)
        prev_month_count = Certificate.objects.filter(
            created_at__gte=prev_month_start, created_at__lt=current_month_start
        ).count()

        prev_year_month_start = current_month_start - relativedelta(years=1)
        prev_year_month_end = prev_year_month_start + relativedelta(months=1)
        prev_year_count = Certificate.objects.filter(
            created_at__gte=prev_year_month_start,
            created_at__lt=prev_year_month_end,
        ).count()

        return {
            "current_month": {
                "count": current_count,
                "month": current_month_start.strftime("%B"),
                "year": current_month_start.year,
            },
            "previous_month": DashboardService._build_comparison(
                current_count, prev_month_count
            ),
            "previous_year_same_month": DashboardService._build_comparison(
                current_count, prev_year_count
            ),
        }

    @staticmethod
    def _financial_year_bounds(reference=None):
        """Return (start, end) datetimes for the Australian FY (Jul–Jun)
        containing the reference date, plus a display label."""
        now = reference or timezone.now()
        if now.month >= 7:
            fy_start = now.replace(
                month=7, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        else:
            fy_start = now.replace(
                year=now.year - 1,
                month=7,
                day=1,
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )
        fy_end = fy_start + relativedelta(years=1)
        label = f"FY {fy_start.year}/{str(fy_start.year + 1)[2:]}"
        return fy_start, fy_end, label

    @staticmethod
    def get_revenue_stats():
        """Compute financial-year revenue from completed batches.

        Revenue is recognised when a batch records its invoice-raised number
        (i.e. its cases are complete). Returns the current FY total and a
        comparison against the previous FY for the same elapsed period.
        """
        now = timezone.now()
        fy_start, fy_end, label = DashboardService._financial_year_bounds(now)

        current_total = (
            Batch.objects.filter(
                invoice_raised_at__gte=fy_start,
                invoice_raised_at__lt=fy_end,
            ).aggregate(total=Sum("total"))["total"]
            or 0
        )

        # Previous FY, same elapsed window (start of prev FY → same offset as now)
        prev_fy_start = fy_start - relativedelta(years=1)
        prev_fy_cutoff = now - relativedelta(years=1)
        prev_total = (
            Batch.objects.filter(
                invoice_raised_at__gte=prev_fy_start,
                invoice_raised_at__lt=prev_fy_cutoff,
            ).aggregate(total=Sum("total"))["total"]
            or 0
        )

        change = None
        if prev_total > 0:
            change = round(
                ((float(current_total) - float(prev_total)) / float(prev_total)) * 100,
                1,
            )
        elif current_total > 0:
            change = 100.0

        return {
            "financial_year": {
                "total": float(current_total),
                "label": label,
            },
            "previous_year": {
                "total": float(prev_total),
                "change_percentage": change,
            },
        }

    @staticmethod
    def get_phase_counts():
        """Return case and form counts for each active (non-complete) phase.

        Returns a dictionary mapping phase name to an object with:
        - cases: number of distinct cases that have at least one form in this phase
        - forms: number of forms in this phase
        """
        active_phases = [
            "assessment",
            "unsigned_generation",
            "batching",
            "in_batch",
        ]

        # Form counts per phase
        form_counts = (
            Priority3Form.objects.exclude(phase="complete")
            .values("phase")
            .annotate(count=Count("id"))
        )
        form_map = {entry["phase"]: entry["count"] for entry in form_counts}

        # Case counts per phase (distinct cases with at least one form in that phase)
        case_counts = (
            Priority3Form.objects.exclude(phase="complete")
            .values("phase")
            .annotate(case_count=Count("case_id", distinct=True))
        )
        case_map = {entry["phase"]: entry["case_count"] for entry in case_counts}

        result = {}
        for phase in active_phases:
            result[phase] = {
                "cases": case_map.get(phase, 0),
                "forms": form_map.get(phase, 0),
            }

        return result

    @staticmethod
    def _build_comparison(current_count, prev_count):
        """Build a comparison dict with percentage change."""
        if prev_count == 0 and current_count == 0:
            return None

        change = None
        if prev_count > 0:
            change = ((current_count - prev_count) / prev_count) * 100
        elif current_count > 0:
            change = 100

        return {
            "count": prev_count,
            "change_percentage": round(change, 1) if change is not None else None,
        }

    @staticmethod
    def get_monthly_throughput():
        """Return monthly throughput for the current financial year.

        Returns an array of 12 monthly entries (Jul–Jun) with:
        - cases: count of cases received that month
        - certs: count of certificates generated that month
        - revenue: total invoice revenue that month
        """
        now = timezone.now()
        # Australian FY starts July 1
        if now.month >= 7:
            fy_start = now.replace(
                month=7, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        else:
            fy_start = now.replace(
                year=now.year - 1,
                month=7,
                day=1,
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )

        months = []
        for i in range(12):
            month_start = fy_start + relativedelta(months=i)
            month_end = month_start + relativedelta(months=1)

            # Only include data for months up to and including current month
            if month_start > now:
                months.append(
                    {
                        "month": month_start.strftime("%b"),
                        "cases": None,
                        "certs": None,
                        "bags": None,
                        "revenue": None,
                    }
                )
                continue

            cases_count = Case.objects.filter(
                received__gte=month_start,
                received__lt=month_end,
            ).count()

            certs_count = Certificate.objects.filter(
                created_at__gte=month_start,
                created_at__lt=month_end,
            ).count()

            bags_count = DrugBag.objects.filter(
                form__case__received__gte=month_start,
                form__case__received__lt=month_end,
            ).count()

            # Revenue is recognised when a batch's invoice-raised number is set
            revenue_total = (
                Batch.objects.filter(
                    invoice_raised_at__gte=month_start,
                    invoice_raised_at__lt=month_end,
                ).aggregate(total=Sum("total"))["total"]
                or 0
            )

            months.append(
                {
                    "month": month_start.strftime("%b"),
                    "cases": cases_count,
                    "certs": certs_count,
                    "bags": bags_count,
                    "revenue": float(revenue_total),
                }
            )

        return months

    @staticmethod
    def get_pending_attention_queryset(user):
        """Return queryset of cases needing the user's attention based on role.

        Returns None if the user has no relevant role filter (e.g. regular
        users without finance/botanist/admin roles).
        """
        if user.role == "finance":
            role_filter = Q(
                forms__phase__in=[
                    "unsigned_generation",
                    "batching",
                ]
            )
        elif user.role == "botanist":
            role_filter = Q(
                forms__phase__in=["assessment"],
                approved_botanist=user,
            )
        elif user.is_superuser:
            role_filter = Q(forms__phase__in=ACTIVE_PHASES)
        else:
            return None

        # Count every bag on the case via a correlated subquery so the count is
        # independent of the forms__phase join used by role_filter (which would
        # otherwise restrict the count to bags on matching-phase forms).
        bags_count = Coalesce(
            Subquery(
                DrugBag.objects.filter(form__case=OuterRef("pk"))
                .order_by()
                .values("form__case")
                .annotate(total=Count("pk"))
                .values("total")[:1]
            ),
            0,
        )

        return (
            Case.objects.filter(role_filter)
            .select_related("approved_botanist", "finance_officer")
            .annotate(bags_count=bags_count)
            .distinct()
            .order_by("received")
        )
