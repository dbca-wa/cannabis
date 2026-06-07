"""Defendant export view — CSV and JSON data exports."""

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from ..services import DefendantService


class DefendantExportView(APIView):
    """Export defendants data in CSV or JSON format."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering", "last_name")
        export_format = request.query_params.get("export_format", "csv").lower()

        settings.LOGGER.info(
            f"User {request.user} requested defendant export "
            f"(format={export_format}, search={search})"
        )

        queryset = DefendantService.get_queryset(search=search, ordering=ordering)
        return DefendantService.export_defendants(queryset, export_format, request.user)
