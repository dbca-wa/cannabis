"""Defendant merge view — combine duplicate defendant records."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services import DefendantService


class DefendantMergeView(APIView):
    """Merge multiple defendant records into a single primary defendant."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        primary_id = request.data.get("primary_id")
        secondary_ids = request.data.get("secondary_ids")
        result = DefendantService.merge_defendants(primary_id, secondary_ids)
        return Response(result)
