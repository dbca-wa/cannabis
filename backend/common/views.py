from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import SystemSettings


class SystemSettingsView(APIView):
    """
    GET: Retrieve system-wide settings (pricing, etc.)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = SystemSettings.load()
        return Response(
            {
                "cost_per_certificate": str(settings.cost_per_certificate),
                "cost_per_bag": str(settings.cost_per_bag),
                "call_out_fee": str(settings.call_out_fee),
                "cost_per_forensic_hour": str(settings.cost_per_forensic_hour),
                "cost_per_kilometer_fuel": str(settings.cost_per_kilometer_fuel),
                "tax_percentage": str(settings.tax_percentage),
            }
        )
