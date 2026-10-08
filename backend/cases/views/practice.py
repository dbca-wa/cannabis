"""Practice mode endpoints.

Turning the mode on and off. The fake brief itself is hardcoded on the client
(it drives the on-screen guide), and the actual workflow is done through the real
screens, which honour the mode via the request-scoped context.
"""

from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from common.practice import is_in_practice_mode, practice_started_at
from users.permissions import HasAppAccess

from ..services.practice_service import PracticeService


def _mode_payload(user):
    return {
        "practice_mode": is_in_practice_mode(user),
        "practice_mode_started_at": practice_started_at(user),
    }


class PracticeModeView(APIView):
    """GET: current practice-mode state. POST: turn on. DELETE: turn off.

    Turning the mode off keeps the user's practice data — it is hidden from the
    live application and shown again next time they enter practice mode. Clearing
    the data is a separate, explicit action (see PracticeResetView).
    """

    permission_classes = [HasAppAccess]

    def get(self, request):
        return Response(_mode_payload(request.user), status=HTTP_200_OK)

    def post(self, request):
        PracticeService.enable_for_user(request.user)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)

    def delete(self, request):
        PracticeService.disable_for_user(request.user)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)


class PracticeResetView(APIView):
    """POST: clear the user's practice data and start a fresh practice session.

    This is the only endpoint that deletes all of the user's practice data, and
    only when the user asks for a clean slate.
    """

    permission_classes = [HasAppAccess]

    def post(self, request):
        PracticeService.reset_for_user(request.user)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)


class PracticeCaseResetView(APIView):
    """POST: restart a single practice case — delete it and its cascades.

    Removes only the user's own practice case the guide is working on, so they
    can start that case over without touching their other practice data.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        from ..models import Case

        try:
            case = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Practice case not found.")
        PracticeService.reset_case_for_user(request.user, case)
        return Response(_mode_payload(request.user), status=HTTP_200_OK)
