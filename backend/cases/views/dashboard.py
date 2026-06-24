from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from ..serializers import PendingAttentionSerializer
from ..services import DashboardService


class MyCasesView(APIView):
    """GET: List cases the current user is involved in based on their role."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings.LOGGER.info(
            f"User {request.user.email} requesting their cases "
            f"(role: {request.user.role})"
        )
        data = DashboardService.get_my_cases(request.user)
        return Response(data, status=HTTP_200_OK)


class CertificateStatsView(APIView):
    """GET: Certificate statistics with month-over-month and YoY comparisons."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings.LOGGER.info(
            f"User {request.user.email} requesting certificate statistics"
        )
        data = DashboardService.get_certificate_stats()
        return Response(data, status=HTTP_200_OK)


class RevenueStatsView(APIView):
    """GET: Revenue statistics with month-over-month and YoY comparisons."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings.LOGGER.info(f"User {request.user.email} requesting revenue statistics")
        data = DashboardService.get_revenue_stats()
        return Response(data, status=HTTP_200_OK)


class MonthlyThroughputView(APIView):
    """GET: Monthly throughput data for the current financial year."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = DashboardService.get_monthly_throughput()
        return Response(data, status=HTTP_200_OK)


class PendingAttentionView(APIView):
    """GET: Submissions requiring the current user's attention based on role."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = DashboardService.get_pending_attention_queryset(request.user)

        if queryset is None:
            serializer = PendingAttentionSerializer([], many=True)
        else:
            serializer = PendingAttentionSerializer(queryset, many=True)

        return Response(serializer.data, status=HTTP_200_OK)


class PhaseCountsView(APIView):
    """GET: Count of cases in each active (non-complete) phase."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = DashboardService.get_phase_counts()
        return Response(data, status=HTTP_200_OK)
