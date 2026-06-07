from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.views import APIView

from ..models import Case, CasePhaseHistory


class CaseWorkflowView(APIView):
    """
    POST: Trigger workflow actions for cases
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            submission = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        action = request.data.get("action")

        if action == "advance_phase":
            return self.advance_phase(request, submission)
        elif action == "generate_certificate":
            return self.generate_certificate(request, submission)
        elif action == "generate_invoice":
            return self.generate_invoice(request, submission)
        else:
            raise ValidationError("Invalid action.")

    def advance_phase(self, request, submission):
        """Advance case to next phase using the workflow service"""
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
        """Generate an unsigned certificate record for the submission."""
        from ..services import generate_unsigned_certificate

        certificate = generate_unsigned_certificate(submission, request.user)

        return Response(
            {
                "message": "Certificate generated successfully",
                "certificate_number": certificate.certificate_number,
            },
            status=HTTP_201_CREATED,
        )

    def generate_invoice(self, request, submission):
        """Generate invoice for submission."""
        from ..services import generate_invoice

        customer_number = request.data.get("customer_number", "").strip()
        invoice = generate_invoice(submission, customer_number, request.user)

        return Response(
            {
                "message": "Invoice generated successfully",
                "invoice_number": invoice.invoice_number,
                "total": str(invoice.total),
            },
            status=HTTP_201_CREATED,
        )


class CaseSendBackView(APIView):
    """
    POST: Send case back to an earlier phase with a reason
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            submission = Case.objects.select_related(
                "approved_botanist", "finance_officer"
            ).get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        target_phase = request.data.get("target_phase")
        reason = request.data.get("reason", "").strip()

        from ..services import send_back_submission

        result = send_back_submission(submission, target_phase, reason, request.user)

        return Response(result, status=HTTP_200_OK)


class CasePhaseHistoryView(ListCreateAPIView):
    """
    GET: List phase history for a specific case
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from ..serializers import CasePhaseHistorySerializer

        return CasePhaseHistorySerializer

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        queryset = CasePhaseHistory.objects.filter(submission_id=pk).select_related(
            "user", "submission"
        )

        # Filter by action type
        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        # Filter by user
        user_id = self.request.query_params.get("user")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by phase
        from_phase = self.request.query_params.get("from_phase")
        if from_phase:
            queryset = queryset.filter(from_phase=from_phase)

        to_phase = self.request.query_params.get("to_phase")
        if to_phase:
            queryset = queryset.filter(to_phase=to_phase)

        # Sorting (default: newest first)
        ordering = self.request.query_params.get("ordering", "-timestamp")
        if ordering:
            queryset = queryset.order_by(ordering)

        return queryset
