"""Dashboard service — business logic for dashboard statistics and user cases.

Encapsulates queries for certificate stats, revenue stats, pending attention
items, and user-specific case lists used by dashboard widgets.
"""

from dateutil.relativedelta import relativedelta
from django.db.models import Count, Q, Sum
from django.utils import timezone

from ..models import Case, Certificate, Invoice


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

        queryset = queryset.exclude(phase=Case.PhaseChoices.COMPLETE).order_by(
            "-received"
        )[:10]

        cases_data = []
        for case in queryset:
            cases_data.append(
                {
                    "id": case.id,
                    "case_number": case.case_number,
                    "phase": case.phase,
                    "phase_display": case.get_phase_display(),
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
    def get_revenue_stats():
        """Compute revenue stats with month-over-month and YoY comparisons.

        Returns:
            A dictionary with current_month, previous_month, and
            previous_year_same_month revenue statistics.
        """
        now = timezone.now()
        current_month_start = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        current_total = (
            Invoice.objects.filter(created_at__gte=current_month_start).aggregate(
                total=Sum("total")
            )["total"]
            or 0
        )

        prev_month_start = current_month_start - relativedelta(months=1)
        prev_month_total = (
            Invoice.objects.filter(
                created_at__gte=prev_month_start,
                created_at__lt=current_month_start,
            ).aggregate(total=Sum("total"))["total"]
            or 0
        )

        prev_year_month_start = current_month_start - relativedelta(years=1)
        prev_year_month_end = prev_year_month_start + relativedelta(months=1)
        prev_year_total = (
            Invoice.objects.filter(
                created_at__gte=prev_year_month_start,
                created_at__lt=prev_year_month_end,
            ).aggregate(total=Sum("total"))["total"]
            or 0
        )

        return {
            "current_month": {
                "total": float(current_total),
                "month": current_month_start.strftime("%B"),
                "year": current_month_start.year,
            },
            "previous_month": DashboardService._build_revenue_comparison(
                current_total, prev_month_total
            ),
            "previous_year_same_month": DashboardService._build_revenue_comparison(
                current_total, prev_year_total
            ),
        }

    @staticmethod
    def get_phase_counts():
        """Return count of cases in each active (non-complete) phase.

        Returns:
            A dictionary mapping phase name to count.
        """
        counts = (
            Case.objects.exclude(phase="complete")
            .values("phase")
            .annotate(count=Count("id"))
        )

        active_phases = [
            "case_creation",
            "assessment",
            "unsigned_generation",
            "botanist_signoff",
            "invoicing",
            "send_emails",
        ]
        result = {phase: 0 for phase in active_phases}
        for entry in counts:
            if entry["phase"] in result:
                result[entry["phase"]] = entry["count"]

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
    def _build_revenue_comparison(current_total, prev_total):
        """Build a revenue comparison dict with percentage change."""
        if prev_total == 0 and current_total == 0:
            return None

        change = None
        if prev_total > 0:
            change = ((current_total - prev_total) / prev_total) * 100
        elif current_total > 0:
            change = 100

        return {
            "total": float(prev_total),
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
                        "revenue": None,
                    }
                )
                continue

            cases_count = Case.objects.filter(
                received__gte=month_start.date(),
                received__lt=month_end.date(),
            ).count()

            certs_count = Certificate.objects.filter(
                created_at__gte=month_start,
                created_at__lt=month_end,
            ).count()

            revenue_total = (
                Invoice.objects.filter(
                    created_at__gte=month_start,
                    created_at__lt=month_end,
                ).aggregate(total=Sum("total"))["total"]
                or 0
            )

            months.append(
                {
                    "month": month_start.strftime("%b"),
                    "cases": cases_count,
                    "certs": certs_count,
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
                phase__in=[
                    "case_creation",
                    "unsigned_generation",
                    "invoicing",
                    "send_emails",
                ]
            )
        elif user.role == "botanist":
            role_filter = Q(
                phase__in=["assessment", "botanist_signoff"],
                approved_botanist=user,
            )
        elif user.is_superuser:
            role_filter = ~Q(phase="complete")
        else:
            return None

        return (
            Case.objects.filter(role_filter)
            .select_related("approved_botanist", "finance_officer")
            .annotate(bags_count=Count("bags"))
            .order_by("received")
        )
