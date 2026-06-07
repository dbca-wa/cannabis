from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_204_NO_CONTENT
from rest_framework.views import APIView

from ..models import CaseDraft
from ..serializers import CaseDraftSerializer


class CaseDraftView(APIView):
    """
    GET: Return the current user's draft (or 404 if none exists).
    PUT: Create or update (upsert) the user's draft.
    DELETE: Remove the user's draft, return 204.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            draft = CaseDraft.objects.get(user=request.user)
        except CaseDraft.DoesNotExist:
            raise NotFound()
        return Response(CaseDraftSerializer(draft).data)

    def put(self, request):
        draft, _ = CaseDraft.objects.update_or_create(
            user=request.user,
            defaults={
                "data": request.data.get("data", {}),
                "current_step": request.data.get("current_step", 0),
            },
        )
        return Response(CaseDraftSerializer(draft).data)

    def delete(self, request):
        CaseDraft.objects.filter(user=request.user).delete()
        return Response(status=HTTP_204_NO_CONTENT)
