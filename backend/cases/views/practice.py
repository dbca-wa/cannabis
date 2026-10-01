"""Practice mode endpoints.

Turning the mode on/off and fetching the fake brief. The actual workflow is done
through the real screens, which honour the mode via the request-scoped context.
"""

from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from common.practice import is_in_practice_mode, practice_expires_at
from users.permissions import HasAppAccess

from ..serializers import PracticeBriefSerializer
from ..services.practice_service import PracticeService


def _mode_payload(user):
    return {
        "practice_mode": is_in_practice_mode(user),
        "practice_mode_expires_at": practice_expires_at(user),
    }


class PracticeModeView(APIView):
    """GET: current practice-mode state. POST: turn on. DELETE: turn off + purge."""

    permission_classes = [HasAppAccess]

    def get(self, request):
        return Response(_mode_payload(request.user), status=HTTP_200_OK)

    def post(self, request):
        PracticeService.enable_for_user(request.user)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)

    def delete(self, request):
        PracticeService.disable_for_user(request.user)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)


class PracticeBriefView(APIView):
    """GET: a fresh fake brief for the user to work through on the case page."""

    permission_classes = [HasAppAccess]

    def get(self, request):
        brief = PracticeService.generate_brief()
        return Response(PracticeBriefSerializer(brief).data, status=HTTP_200_OK)
