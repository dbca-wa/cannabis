from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import CasePhaseHistory, Priority3Form


class FormWorkflowView(APIView):
    """
    POST: Advance a Priority 3 form to its next workflow phase.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        try:
            form = Priority3Form.objects.select_related("case").get(pk=pk)
        except Priority3Form.DoesNotExist:
            raise NotFound("Priority 3 form not found.")

        # Completed forms are read-only for non-admins (server-side guard).
        from ..permissions import ensure_form_editable

        ensure_form_editable(form, request.user)

        action = request.data.get("action")
        if action != "advance_phase":
            raise ValidationError("Invalid action.")

        from ..services import WorkflowService

        new_phase = WorkflowService.advance_form(form, request.user)

        return Response(
            {
                "message": f"Form advanced to {form.get_phase_display()}",
                "new_phase": new_phase,
            },
            status=HTTP_200_OK,
        )


class CasePhaseHistoryView(ListCreateAPIView):
    """
    GET: List phase history for a specific case.
    """

    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        from ..serializers import CasePhaseHistorySerializer

        return CasePhaseHistorySerializer

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        queryset = CasePhaseHistory.objects.filter(submission_id=pk).select_related(
            "user", "submission"
        )

        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        user_id = self.request.query_params.get("user")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        from_phase = self.request.query_params.get("from_phase")
        if from_phase:
            queryset = queryset.filter(from_phase=from_phase)

        to_phase = self.request.query_params.get("to_phase")
        if to_phase:
            queryset = queryset.filter(to_phase=to_phase)

        ordering = self.request.query_params.get("ordering", "-timestamp")
        if ordering:
            queryset = queryset.order_by(ordering)

        return queryset
