"""Defendant export view — CSV and JSON data exports."""

from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..services import DefendantService


class DefendantExportView(APIView):
    """Export defendants data in CSV or JSON format."""

    permission_classes = [HasAppAccess]

    def get(self, request):
        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering", "last_name")
        export_format = request.query_params.get("export_format", "csv").lower()

        queryset = DefendantService.get_queryset(search=search, ordering=ordering)
        return DefendantService.export_defendants(queryset, export_format, request.user)
