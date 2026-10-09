"""Page-view beacon.

The SPA fires one request here when the user navigates to a page, so the audit
log carries a single clean line for what the user is actually looking at —
independent of the many data-fetch calls a page makes. Pages that have no
dedicated backend read (How To, Settings, the testing tools) are covered too,
because the log follows the route, not the API traffic.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_204_NO_CONTENT
from rest_framework.views import APIView

from common.logging import log_read

# Allow-listed page keys mapped to the phrase logged after the acting user.
# Only these keys are accepted; anything else is ignored, so a client can never
# write arbitrary text into the audit log. Keys match the frontend route names.
PAGE_LABELS = {
    "dashboard": "viewed the dashboard",
    "cases": "viewed the cases list",
    "case": "viewed case",  # object page — id appended
    "case-create": "opened the new-case form",
    "batches": "viewed the batches list",
    "batch": "viewed batch",  # object page — id appended
    "staff": "viewed the staff list",
    "officers": "viewed the officers list",
    "officer": "viewed officer",  # object page — id appended
    "stations": "viewed the stations list",
    "station": "viewed station",  # object page — id appended
    "defendants": "viewed the defendants list",
    "defendant": "viewed defendant",  # object page — id appended
    "invitations": "viewed the invitations list",
    "settings": "viewed the settings page",
    "testing": "viewed the testing tools page",
    "guide": "viewed the how-to guide",
    "change-password": "opened the change-password page",
}

# Keys that name a single record, so a provided object id is appended as (id=N).
OBJECT_PAGES = {"case", "batch", "officer", "station", "defendant"}


class PageViewView(APIView):
    """POST: record that the current user opened a page.

    Body: ``{"page": "<key>", "object_id": <int|str, optional>}``. Emits exactly
    one INFO line per accepted call. An unknown page key is a silent no-op so a
    stale or misbehaving client cannot inject log lines or cause errors.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        page = request.data.get("page")
        phrase = PAGE_LABELS.get(page)
        if phrase is None:
            # Unknown/absent key — accept quietly without logging.
            return Response(status=HTTP_204_NO_CONTENT)

        if page in OBJECT_PAGES:
            object_id = request.data.get("object_id")
            if object_id not in (None, ""):
                phrase = f"{phrase} (id={object_id})"

        log_read(request.user, phrase)
        return Response(status=HTTP_204_NO_CONTENT)
