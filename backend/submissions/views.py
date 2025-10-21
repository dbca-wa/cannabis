from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import *
from rest_framework.exceptions import ValidationError
from django.db.models import Q, Count, Prefetch, F
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import (
    Submission,
    SubmissionPhaseHistory,
    DrugBag,
    BotanicalAssessment,
    Certificate,
    Invoice,
    AdditionalInvoiceFee,
)
from .serializers import (
    SubmissionListSerializer,
    SubmissionSerializer,
    SubmissionCreateSerializer,
    SubmissionUpdateSerializer,
    DrugBagSerializer,
    DrugBagCreateSerializer,
    BotanicalAssessmentSerializer,
    CertificateSerializer,
    InvoiceSerializer,
    AdditionalInvoiceFeeSerializer,
)


# SUBMISSION VIEWS
# ============================================================================


class SubmissionListView(ListCreateAPIView):
    """
    GET: List submissions with filtering and search
    POST: Create new submission
    """

    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """Override create to add detailed logging"""
        user = request.user
        settings.LOGGER.info(
            f"{user.get_full_name() if hasattr(user, 'get_full_name') else user} is attempting to create a submission"
        )
        settings.LOGGER.debug(f"Request data: {request.data}")

        try:
            response = super().create(request, *args, **kwargs)
            settings.LOGGER.info(
                f"Submission created successfully with status {response.status_code}"
            )
            return response
        except ValidationError as e:
            settings.LOGGER.error(
                f"Validation error creating submission for user {user.get_full_name() if hasattr(user, 'get_full_name') else user}: {e.detail}",
                exc_info=True,
            )
            raise
        except Exception as e:
            settings.LOGGER.error(
                f"Unexpected error creating submission for user {user.get_full_name() if hasattr(user, 'get_full_name') else user}: {str(e)}",
                exc_info=True,
            )
            raise

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SubmissionCreateSerializer
        elif self.request.query_params.get("full") == "true":
            return SubmissionSerializer
        return SubmissionListSerializer

    def get_queryset(self):
        user = self.request.user

        # Build detailed filter description for logging
        filters = []
        phase = self.request.query_params.get("phase")
        if phase:
            filters.append(f"phase={phase}")

        botanist_id = self.request.query_params.get("botanist")
        if botanist_id:
            filters.append(f"botanist={botanist_id}")

        finance_id = self.request.query_params.get("finance")
        if finance_id:
            filters.append(f"finance={finance_id}")

        requesting_officer_id = self.request.query_params.get("requesting_officer")
        if requesting_officer_id:
            filters.append(f"requesting_officer={requesting_officer_id}")

        draft_only = self.request.query_params.get("draft_only")
        if draft_only:
            filters.append(f"draft_only={draft_only}")

        cannabis_only = self.request.query_params.get("cannabis_only")
        if cannabis_only:
            filters.append(f"cannabis_only={cannabis_only}")

        search = self.request.query_params.get("search")
        if search:
            filters.append(f"search='{search}'")

        date_from = self.request.query_params.get("date_from")
        if date_from:
            filters.append(f"date_from={date_from}")

        date_to = self.request.query_params.get("date_to")
        if date_to:
            filters.append(f"date_to={date_to}")

        ordering = self.request.query_params.get("ordering", "-received")
        filters.append(f"ordering={ordering}")

        # Log with all filters
        filter_str = ", ".join(filters) if filters else "no filters"
        settings.LOGGER.info(
            f"User {user.email} is requesting submissions list ({filter_str})"
        )

        queryset = Submission.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
        ).prefetch_related("defendants", "bags")

        # Filter by phase
        if phase:
            queryset = queryset.filter(phase=phase)

        # Filter by assigned staff
        if botanist_id:
            queryset = queryset.filter(approved_botanist_id=botanist_id)

        if finance_id:
            queryset = queryset.filter(finance_officer_id=finance_id)

        if requesting_officer_id:
            queryset = queryset.filter(requesting_officer_id=requesting_officer_id)

        # Filter by draft status
        if draft_only and draft_only.lower() == "true":
            queryset = queryset.filter(is_draft=True)

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(case_number__icontains=search)
                | Q(requesting_officer__first_name__icontains=search)
                | Q(requesting_officer__last_name__icontains=search)
                | Q(approved_botanist__first_name__icontains=search)
                | Q(approved_botanist__last_name__icontains=search)
                | Q(finance_officer__first_name__icontains=search)
                | Q(finance_officer__last_name__icontains=search)
                | Q(defendants__first_name__icontains=search)
                | Q(defendants__last_name__icontains=search)
            ).distinct()

        # Filter by date range
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(received__gte=date_from)
        if date_to:
            queryset = queryset.filter(received__lte=date_to)

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "-received")

        # Validate and apply ordering
        # Support ordering by: case_number, received, phase, is_draft, approved_botanist__last_name, finance_officer__last_name, requesting_officer__last_name
        valid_orderings = [
            "case_number",
            "-case_number",
            "received",
            "-received",
            "phase",
            "-phase",
            "is_draft",
            "-is_draft",
            "approved_botanist__last_name",
            "-approved_botanist__last_name",
            "finance_officer__last_name",
            "-finance_officer__last_name",
            "requesting_officer__last_name",
            "-requesting_officer__last_name",
        ]

        if ordering in valid_orderings:
            # Handle NULL values for officer sorting
            # NULL values should always appear at the end regardless of sort direction
            if ordering == "approved_botanist__last_name":
                queryset = queryset.order_by(
                    F("approved_botanist__last_name").asc(nulls_last=True)
                )
            elif ordering == "-approved_botanist__last_name":
                queryset = queryset.order_by(
                    F("approved_botanist__last_name").desc(nulls_last=True)
                )
            elif ordering == "finance_officer__last_name":
                queryset = queryset.order_by(
                    F("finance_officer__last_name").asc(nulls_last=True)
                )
            elif ordering == "-finance_officer__last_name":
                queryset = queryset.order_by(
                    F("finance_officer__last_name").desc(nulls_last=True)
                )
            elif ordering == "requesting_officer__last_name":
                queryset = queryset.order_by(
                    F("requesting_officer__last_name").asc(nulls_last=True)
                )
            elif ordering == "-requesting_officer__last_name":
                queryset = queryset.order_by(
                    F("requesting_officer__last_name").desc(nulls_last=True)
                )
            else:
                queryset = queryset.order_by(ordering)
        else:
            # Default to received descending if invalid ordering
            queryset = queryset.order_by("-received")

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        settings.LOGGER.info(
            f"{user.get_full_name() if hasattr(user, 'get_full_name') else user} is trying to save a submission as a draft"
        )
        settings.LOGGER.debug(f"Submission data: {serializer.validated_data}")

        try:
            submission = serializer.save()
            settings.LOGGER.info(
                f"User {user.get_full_name() if hasattr(user, 'get_full_name') else user} successfully created submission: {submission.case_number}"
            )
        except Exception as e:
            settings.LOGGER.error(
                f"Failed to create submission for user {user.get_full_name() if hasattr(user, 'get_full_name') else user}. Error: {str(e)}",
                exc_info=True,
            )
            raise


class SubmissionDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve submission details
    PUT/PATCH: Update submission
    DELETE: Delete submission
    """

    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Submission.objects.select_related(
            "approved_botanist",
            "finance_officer",
            "requesting_officer",
            "submitting_officer",
        ).prefetch_related(
            "defendants",
            "bags__assessment",
            "certificates",
            "invoices",
            "additional_fees",
        )

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return SubmissionUpdateSerializer
        return SubmissionSerializer

    def perform_update(self, serializer):
        old_phase = self.get_object().phase
        submission = serializer.save()
        new_phase = submission.phase

        # Log phase changes
        if old_phase != new_phase:
            settings.LOGGER.info(
                f"User {self.request.user} changed submission {submission.case_number} phase from {old_phase} to {new_phase}"
            )

            # Update workflow timestamps
            now = timezone.now()
            if new_phase == Submission.PhaseChoices.FINANCE_APPROVAL_PROVIDED:
                submission.finance_approved_at = now
            elif new_phase == Submission.PhaseChoices.BOTANIST_APPROVAL_PROVIDED:
                submission.botanist_approved_at = now
            elif new_phase == Submission.PhaseChoices.COMPLETE:
                submission.completed_at = now

            submission.save(
                update_fields=[
                    "finance_approved_at",
                    "botanist_approved_at",
                    "completed_at",
                ]
            )

    def perform_destroy(self, instance):
        settings.LOGGER.warning(
            f"User {self.request.user} deleted submission: {instance}"
        )
        super().perform_destroy(instance)


# ============================================================================
# DRUG BAG VIEWS
# ============================================================================


class DrugBagListView(ListCreateAPIView):
    """
    GET: List drug bags for a specific submission
    POST: Create new drug bag
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DrugBagCreateSerializer
        return DrugBagSerializer

    def get_queryset(self):
        submission_id = self.kwargs.get("submission_id")
        return (
            DrugBag.objects.filter(submission_id=submission_id)
            .prefetch_related("assessment")
            .order_by("seal_tag_number")
        )

    def perform_create(self, serializer):
        bag = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} created drug bag {bag.seal_tag_numbers} for submission {bag.submission.case_number}"
        )


class DrugBagDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve drug bag details
    PUT/PATCH: Update drug bag
    DELETE: Delete drug bag
    """

    queryset = (
        DrugBag.objects.all()
        .select_related("submission")
        .prefetch_related("assessment")
    )
    serializer_class = DrugBagSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} updated drug bag: {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        settings.LOGGER.warning(
            f"User {self.request.user} deleted drug bag: {instance}"
        )
        super().perform_destroy(instance)


# ============================================================================
# BOTANICAL ASSESSMENT VIEWS
# ============================================================================


class BotanicalAssessmentDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve botanical assessment
    PUT/PATCH: Update assessment (botanists only)
    DELETE: Delete assessment
    """

    queryset = BotanicalAssessment.objects.all().select_related("drug_bag__submission")
    serializer_class = BotanicalAssessmentSerializer
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        """Only botanists can update assessments"""
        super().check_object_permissions(request, obj)

        if request.method in ["PUT", "PATCH"]:
            if not (request.user.role == "botanist" or request.user.is_staff):
                self.permission_denied(request, "Only botanists can update assessments")

    def perform_update(self, serializer):
        # Auto-set assessment date if determination is being set
        if (
            serializer.validated_data.get("determination")
            and not serializer.instance.assessment_date
        ):
            serializer.save(assessment_date=timezone.now())
        else:
            serializer.save()

        settings.LOGGER.info(
            f"Botanist {self.request.user} updated assessment: {serializer.instance}"
        )


class BotanicalAssessmentCreateView(APIView):
    """
    POST: Create botanical assessment for a drug bag
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, drug_bag_id):
        try:
            drug_bag = DrugBag.objects.get(pk=drug_bag_id)
        except DrugBag.DoesNotExist:
            return Response({"error": "Drug bag not found"}, status=HTTP_404_NOT_FOUND)

        # Check if assessment already exists
        if hasattr(drug_bag, "assessment"):
            return Response(
                {"error": "Assessment already exists for this drug bag"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Only botanists can create assessments
        if not (request.user.role == "botanist" or request.user.is_staff):
            return Response(
                {"error": "Only botanists can create assessments"},
                status=HTTP_403_FORBIDDEN,
            )

        serializer = BotanicalAssessmentSerializer(data=request.data)
        if serializer.is_valid():
            assessment = serializer.save(drug_bag=drug_bag)
            settings.LOGGER.info(
                f"Botanist {request.user} created assessment for bag {drug_bag.seal_tag_number}"
            )
            return Response(serializer.data, status=HTTP_201_CREATED)

        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


# ============================================================================
# CERTIFICATE & INVOICE VIEWS
# ============================================================================


class CertificateListView(ListCreateAPIView):
    """
    GET: List certificates for a submission
    POST: Create new certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        submission_id = self.kwargs.get("submission_id")
        return Certificate.objects.filter(submission_id=submission_id).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        submission_id = self.kwargs.get("submission_id")
        try:
            submission = Submission.objects.get(pk=submission_id)
        except Submission.DoesNotExist:
            raise ValidationError("Submission not found")

        certificate = serializer.save(submission=submission)
        settings.LOGGER.info(
            f"User {self.request.user} created certificate {certificate.certificate_number}"
        )


class CertificateDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve certificate details
    PUT/PATCH: Update certificate
    DELETE: Delete certificate
    """

    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]
    queryset = Certificate.objects.all()

    def perform_update(self, serializer):
        certificate = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated certificate {certificate.certificate_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.info(
            f"User {self.request.user} deleted certificate {instance.certificate_number}"
        )
        instance.delete()


class InvoiceListView(ListCreateAPIView):
    """
    GET: List invoices for a submission
    POST: Create new invoice
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        submission_id = self.kwargs.get("submission_id")
        return Invoice.objects.filter(submission_id=submission_id).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        submission_id = self.kwargs.get("submission_id")
        try:
            submission = Submission.objects.get(pk=submission_id)
        except Submission.DoesNotExist:
            raise ValidationError("Submission not found")

        invoice = serializer.save(submission=submission)
        settings.LOGGER.info(
            f"User {self.request.user} created invoice {invoice.invoice_number}"
        )


class InvoiceDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve invoice details
    PUT/PATCH: Update invoice
    DELETE: Delete invoice
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    queryset = Invoice.objects.all()

    def perform_update(self, serializer):
        invoice = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated invoice {invoice.invoice_number}"
        )

    def perform_destroy(self, instance):
        settings.LOGGER.info(
            f"User {self.request.user} deleted invoice {instance.invoice_number}"
        )
        instance.delete()


class AdditionalInvoiceFeeListView(ListCreateAPIView):
    """
    GET: List additional fees for a submission
    POST: Create new additional fee
    """

    serializer_class = AdditionalInvoiceFeeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        submission_id = self.kwargs.get("submission_id")
        return AdditionalInvoiceFee.objects.filter(
            submission_id=submission_id
        ).order_by("-created_at")

    def perform_create(self, serializer):
        fee = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created additional fee: {fee}")


# ============================================================================
# WORKFLOW ACTION VIEWS
# ============================================================================


class SubmissionSendBackView(APIView):
    """
    POST: Send submission back to an earlier phase with a reason
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        try:
            submission = Submission.objects.select_related(
                "approved_botanist", "finance_officer"
            ).get(pk=submission_id)
        except Submission.DoesNotExist:
            return Response(
                {"error": "Submission not found"}, status=HTTP_404_NOT_FOUND
            )

        target_phase = request.data.get("target_phase")
        reason = request.data.get("reason", "").strip()

        # Validate target phase
        if not target_phase:
            return Response(
                {"error": "target_phase is required"}, status=HTTP_400_BAD_REQUEST
            )

        if target_phase not in dict(Submission.PhaseChoices.choices):
            return Response(
                {"error": f"Invalid target phase: {target_phase}"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Validate reason
        if not reason:
            return Response(
                {"error": "reason is required for send-back actions"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Check permissions
        user = request.user
        current_phase = submission.phase

        # Define which phases can be sent back from and to which phases
        send_back_permissions = {
            Submission.PhaseChoices.FINANCE_APPROVAL: {
                "allowed_roles": ["finance"],
                "allowed_targets": [Submission.PhaseChoices.DATA_ENTRY],
            },
            Submission.PhaseChoices.BOTANIST_REVIEW: {
                "allowed_roles": ["botanist"],
                "allowed_targets": [
                    Submission.PhaseChoices.DATA_ENTRY,
                    Submission.PhaseChoices.FINANCE_APPROVAL,
                ],
            },
            Submission.PhaseChoices.DOCUMENTS: {
                "allowed_roles": ["botanist", "finance"],
                "allowed_targets": [
                    Submission.PhaseChoices.DATA_ENTRY,
                    Submission.PhaseChoices.FINANCE_APPROVAL,
                    Submission.PhaseChoices.BOTANIST_REVIEW,
                ],
            },
            Submission.PhaseChoices.SEND_EMAILS: {
                "allowed_roles": ["botanist", "finance"],
                "allowed_targets": [
                    Submission.PhaseChoices.DATA_ENTRY,
                    Submission.PhaseChoices.FINANCE_APPROVAL,
                    Submission.PhaseChoices.BOTANIST_REVIEW,
                    Submission.PhaseChoices.DOCUMENTS,
                ],
            },
        }

        # Admin override - can send back from any phase to any earlier phase
        if not user.is_superuser:
            # Check if current phase allows send-back
            if current_phase not in send_back_permissions:
                return Response(
                    {
                        "error": f"Cannot send back from phase {submission.get_phase_display()}"
                    },
                    status=HTTP_403_FORBIDDEN,
                )

            phase_config = send_back_permissions[current_phase]

            # Check user role
            if user.role not in phase_config["allowed_roles"]:
                return Response(
                    {
                        "error": f"Only {', '.join(phase_config['allowed_roles'])} can send back from {submission.get_phase_display()}"
                    },
                    status=HTTP_403_FORBIDDEN,
                )

            # Check target phase is allowed
            if target_phase not in phase_config["allowed_targets"]:
                allowed_targets_display = ", ".join(
                    [
                        dict(Submission.PhaseChoices.choices)[t]
                        for t in phase_config["allowed_targets"]
                    ]
                )
                return Response(
                    {
                        "error": f"Can only send back to: {allowed_targets_display} from {submission.get_phase_display()}"
                    },
                    status=HTTP_400_BAD_REQUEST,
                )

        # Validate target phase is earlier than current phase
        phase_order = [
            Submission.PhaseChoices.DATA_ENTRY,
            Submission.PhaseChoices.FINANCE_APPROVAL,
            Submission.PhaseChoices.BOTANIST_REVIEW,
            Submission.PhaseChoices.DOCUMENTS,
            Submission.PhaseChoices.SEND_EMAILS,
            Submission.PhaseChoices.COMPLETE,
        ]

        try:
            current_index = phase_order.index(current_phase)
            target_index = phase_order.index(target_phase)

            if target_index >= current_index:
                return Response(
                    {"error": "Can only send back to an earlier phase"},
                    status=HTTP_400_BAD_REQUEST,
                )
        except ValueError:
            return Response(
                {"error": "Invalid phase configuration"}, status=HTTP_400_BAD_REQUEST
            )

        # Create phase history entry
        from .models import SubmissionPhaseHistory

        SubmissionPhaseHistory.objects.create(
            submission=submission,
            from_phase=current_phase,
            to_phase=target_phase,
            action="send_back",
            user=user,
            reason=reason,
        )

        # Update submission phase
        old_phase_display = submission.get_phase_display()
        submission.phase = target_phase
        submission.save(update_fields=["phase"])

        new_phase_display = submission.get_phase_display()

        settings.LOGGER.info(
            f"User {user.get_full_name()} sent back submission {submission.case_number} "
            f"from {old_phase_display} to {new_phase_display}. Reason: {reason}"
        )

        return Response(
            {
                "message": f"Submission sent back to {new_phase_display}",
                "new_phase": target_phase,
                "sent_back_by": user.get_full_name(),
                "sent_back_at": timezone.now().isoformat(),
                "reason": reason,
            },
            status=HTTP_200_OK,
        )


class SubmissionPhaseHistoryView(ListCreateAPIView):
    """
    GET: List phase history for a specific submission
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from .serializers import SubmissionPhaseHistorySerializer

        return SubmissionPhaseHistorySerializer

    def get_queryset(self):
        submission_id = self.kwargs.get("submission_id")
        queryset = SubmissionPhaseHistory.objects.filter(
            submission_id=submission_id
        ).select_related("user", "submission")

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


class SubmissionWorkflowView(APIView):
    """
    POST: Trigger workflow actions for submissions
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        try:
            submission = Submission.objects.get(pk=submission_id)
        except Submission.DoesNotExist:
            return Response(
                {"error": "Submission not found"}, status=HTTP_404_NOT_FOUND
            )

        action = request.data.get("action")

        if action == "advance_phase":
            return self.advance_phase(request, submission)
        elif action == "generate_certificate":
            return self.generate_certificate(request, submission)
        elif action == "generate_invoice":
            return self.generate_invoice(request, submission)
        else:
            return Response({"error": "Invalid action"}, status=HTTP_400_BAD_REQUEST)

    def advance_phase(self, request, submission):
        """Advance submission to next phase"""
        phase_transitions = {
            Submission.PhaseChoices.DATA_ENTRY: Submission.PhaseChoices.FINANCE_APPROVAL_PROVIDED,
            Submission.PhaseChoices.FINANCE_APPROVAL_PROVIDED: Submission.PhaseChoices.BOTANIST_APPROVAL_PROVIDED,
            Submission.PhaseChoices.BOTANIST_APPROVAL_PROVIDED: Submission.PhaseChoices.IN_REVIEW,
            Submission.PhaseChoices.IN_REVIEW: Submission.PhaseChoices.CERTIFICATE_GENERATION,
            Submission.PhaseChoices.CERTIFICATE_GENERATION: Submission.PhaseChoices.INVOICE_GENERATION,
            Submission.PhaseChoices.INVOICE_GENERATION: Submission.PhaseChoices.SENDING_EMAILS,
            Submission.PhaseChoices.SENDING_EMAILS: Submission.PhaseChoices.COMPLETE,
        }

        next_phase = phase_transitions.get(submission.phase)
        if not next_phase:
            return Response(
                {
                    "error": f"Cannot advance from phase {submission.get_phase_display()}"
                },
                status=HTTP_400_BAD_REQUEST,
            )

        submission.phase = next_phase
        submission.save()

        settings.LOGGER.info(
            f"User {request.user} advanced submission {submission.case_number} to {next_phase}"
        )

        return Response(
            {
                "message": f"Submission advanced to {submission.get_phase_display()}",
                "new_phase": next_phase,
            },
            status=HTTP_200_OK,
        )

    def generate_certificate(self, request, submission):
        """Generate certificate for submission"""
        # Check if certificate already exists
        if submission.certificates.exists():
            return Response(
                {"error": "Certificate already exists for this submission"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Create certificate
        certificate = Certificate.objects.create(submission=submission)
        submission.certificates_generated_at = timezone.now()
        submission.save(update_fields=["certificates_generated_at"])

        settings.LOGGER.info(
            f"User {request.user} generated certificate {certificate.certificate_number}"
        )

        return Response(
            {
                "message": "Certificate generated successfully",
                "certificate_number": certificate.certificate_number,
            },
            status=HTTP_201_CREATED,
        )

    def generate_invoice(self, request, submission):
        """Generate invoice for submission"""
        customer_number = request.data.get("customer_number")
        if not customer_number:
            return Response(
                {"error": "Customer number is required"}, status=HTTP_400_BAD_REQUEST
            )

        # Create invoice
        invoice = Invoice.objects.create(
            submission=submission, customer_number=customer_number
        )
        submission.invoices_generated_at = timezone.now()
        submission.save(update_fields=["invoices_generated_at"])

        settings.LOGGER.info(
            f"User {request.user} generated invoice {invoice.invoice_number}"
        )

        return Response(
            {
                "message": "Invoice generated successfully",
                "invoice_number": invoice.invoice_number,
                "total": str(invoice.total),
            },
            status=HTTP_201_CREATED,
        )
