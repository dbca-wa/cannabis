from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case, CasePhaseHistory


class CaseWorkflowView(APIView):
    """
    POST: Trigger workflow actions for cases.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        try:
            submission = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        # Complete cases are read-only for non-admins (server-side guard).
        from ..permissions import ensure_case_editable

        ensure_case_editable(submission, request.user)

        action = request.data.get("action")

        if action == "advance_phase":
            return self.advance_phase(request, submission)
        elif action == "generate_certificate":
            return self.generate_certificate(request, submission)
        else:
            raise ValidationError("Invalid action.")

    def advance_phase(self, request, submission):
        """Advance case to next phase using the workflow service."""
        from ..services import advance_submission_phase

        new_phase = advance_submission_phase(submission, request.user)

        return Response(
            {
                "message": f"Case advanced to {submission.get_phase_display()}",
                "new_phase": new_phase,
            },
            status=HTTP_200_OK,
        )

    def generate_certificate(self, request, submission):
        """Generate certificate PDFs for the case (one per bag group)."""
        from ..services import CertificateService

        groups = request.data.get("groups")
        group_notes = request.data.get("group_notes")
        certificates = CertificateService.generate_certificates(
            submission, request.user, groups=groups, group_notes=group_notes
        )

        return Response(
            {
                "message": "Certificates generated successfully",
                "certificate_numbers": [c.certificate_number for c in certificates],
            },
            status=HTTP_201_CREATED,
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
