from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import *
from django.db.models import Q, Count, Prefetch
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import (
    Defendant, Submission, DrugBag, BotanicalAssessment, 
    Certificate, Invoice, AdditionalInvoiceFee
)
from .serializers import (
    DefendantSerializer, SubmissionListSerializer, SubmissionSerializer,
    SubmissionCreateSerializer, SubmissionUpdateSerializer, DrugBagSerializer,
    DrugBagCreateSerializer, BotanicalAssessmentSerializer, CertificateSerializer,
    InvoiceSerializer, AdditionalInvoiceFeeSerializer
)


# ============================================================================
# DEFENDANT VIEWS
# ============================================================================

class DefendantListView(ListCreateAPIView):
    """
    GET: List all defendants with search
    POST: Create new defendant
    """
    queryset = Defendant.objects.all().order_by('last_name', 'first_name')
    serializer_class = DefendantSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        return queryset
    
    def perform_create(self, serializer):
        defendant = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created defendant: {defendant}")


class DefendantDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve defendant details
    PUT/PATCH: Update defendant
    DELETE: Delete defendant
    """
    queryset = Defendant.objects.all()
    serializer_class = DefendantSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_update(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} updated defendant: {serializer.instance}")
        serializer.save()
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted defendant: {instance}")
        super().perform_destroy(instance)


# ============================================================================
# SUBMISSION VIEWS
# ============================================================================

class SubmissionListView(ListCreateAPIView):
    """
    GET: List submissions with filtering and search
    POST: Create new submission
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubmissionCreateSerializer
        elif self.request.query_params.get('full') == 'true':
            return SubmissionSerializer
        return SubmissionListSerializer
    
    def get_queryset(self):
        queryset = Submission.objects.select_related(
            'approved_botanist', 'finance_officer', 'requesting_officer', 'submitting_officer'
        ).prefetch_related('defendants', 'bags')
        
        # Filter by phase
        phase = self.request.query_params.get('phase')
        if phase:
            queryset = queryset.filter(phase=phase)
        
        # Filter by assigned staff
        botanist_id = self.request.query_params.get('botanist')
        if botanist_id:
            queryset = queryset.filter(approved_botanist_id=botanist_id)
        
        finance_id = self.request.query_params.get('finance')
        if finance_id:
            queryset = queryset.filter(finance_officer_id=finance_id)
        
        # Filter by cannabis presence
        cannabis_only = self.request.query_params.get('cannabis_only')
        if cannabis_only and cannabis_only.lower() == 'true':
            queryset = queryset.filter(
                bags__assessments__determination__in=[
                    BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
                    BotanicalAssessment.DeterminationChoices.CANNABIS_INDICA,
                    BotanicalAssessment.DeterminationChoices.CANNABIS_HYBRID,
                ]
            ).distinct()
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(case_number__icontains=search) |
                Q(requesting_officer__first_name__icontains=search) |
                Q(requesting_officer__last_name__icontains=search) |
                Q(defendants__first_name__icontains=search) |
                Q(defendants__last_name__icontains=search)
            ).distinct()
        
        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(received__gte=date_from)
        if date_to:
            queryset = queryset.filter(received__lte=date_to)
        
        return queryset.order_by('-received')
    
    def perform_create(self, serializer):
        submission = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created submission: {submission.case_number}")


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
            'approved_botanist', 'finance_officer', 'requesting_officer', 'submitting_officer'
        ).prefetch_related(
            'defendants',
            'bags__assessment',
            'certificates',
            'invoices',
            'additional_fees'
        )
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SubmissionUpdateSerializer
        return SubmissionSerializer
    
    def perform_update(self, serializer):
        old_phase = self.get_object().phase
        submission = serializer.save()
        new_phase = submission.phase
        
        # Log phase changes
        if old_phase != new_phase:
            settings.LOGGER.info(f"User {self.request.user} changed submission {submission.case_number} phase from {old_phase} to {new_phase}")
            
            # Update workflow timestamps
            now = timezone.now()
            if new_phase == Submission.PhaseChoices.FINANCE_APPROVAL_PROVIDED:
                submission.finance_approved_at = now
            elif new_phase == Submission.PhaseChoices.BOTANIST_APPROVAL_PROVIDED:
                submission.botanist_approved_at = now
            elif new_phase == Submission.PhaseChoices.COMPLETE:
                submission.completed_at = now
            
            submission.save(update_fields=['finance_approved_at', 'botanist_approved_at', 'completed_at'])
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted submission: {instance}")
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
        if self.request.method == 'POST':
            return DrugBagCreateSerializer
        return DrugBagSerializer
    
    def get_queryset(self):
        submission_id = self.kwargs.get('submission_id')
        return DrugBag.objects.filter(
            submission_id=submission_id
        ).prefetch_related('assessment').order_by('seal_tag_number')
    
    def perform_create(self, serializer):
        bag = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created drug bag {bag.seal_tag_number} for submission {bag.submission.case_number}")


class DrugBagDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve drug bag details
    PUT/PATCH: Update drug bag
    DELETE: Delete drug bag
    """
    queryset = DrugBag.objects.all().select_related('submission').prefetch_related('assessment')
    serializer_class = DrugBagSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_update(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} updated drug bag: {serializer.instance}")
        serializer.save()
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted drug bag: {instance}")
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
    queryset = BotanicalAssessment.objects.all().select_related('drug_bag__submission')
    serializer_class = BotanicalAssessmentSerializer
    permission_classes = [IsAuthenticated]
    
    def check_object_permissions(self, request, obj):
        """Only botanists can update assessments"""
        super().check_object_permissions(request, obj)
        
        if request.method in ['PUT', 'PATCH']:
            if not (request.user.role == 'botanist' or request.user.is_staff):
                self.permission_denied(request, "Only botanists can update assessments")
    
    def perform_update(self, serializer):
        # Auto-set assessment date if determination is being set
        if serializer.validated_data.get('determination') and not serializer.instance.assessment_date:
            serializer.save(assessment_date=timezone.now())
        else:
            serializer.save()
        
        settings.LOGGER.info(f"Botanist {self.request.user} updated assessment: {serializer.instance}")


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
        if hasattr(drug_bag, 'assessment'):
            return Response(
                {"error": "Assessment already exists for this drug bag"}, 
                status=HTTP_400_BAD_REQUEST
            )
        
        # Only botanists can create assessments
        if not (request.user.role == 'botanist' or request.user.is_staff):
            return Response(
                {"error": "Only botanists can create assessments"}, 
                status=HTTP_403_FORBIDDEN
            )
        
        serializer = BotanicalAssessmentSerializer(data=request.data)
        if serializer.is_valid():
            assessment = serializer.save(drug_bag=drug_bag)
            settings.LOGGER.info(f"Botanist {request.user} created assessment for bag {drug_bag.seal_tag_number}")
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
        submission_id = self.kwargs.get('submission_id')
        return Certificate.objects.filter(submission_id=submission_id).order_by('-created_at')
    
    def perform_create(self, serializer):
        certificate = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created certificate {certificate.certificate_number}")


class InvoiceListView(ListCreateAPIView):
    """
    GET: List invoices for a submission
    POST: Create new invoice
    """
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        submission_id = self.kwargs.get('submission_id')
        return Invoice.objects.filter(submission_id=submission_id).order_by('-created_at')
    
    def perform_create(self, serializer):
        invoice = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created invoice {invoice.invoice_number}")


class AdditionalInvoiceFeeListView(ListCreateAPIView):
    """
    GET: List additional fees for a submission
    POST: Create new additional fee
    """
    serializer_class = AdditionalInvoiceFeeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        submission_id = self.kwargs.get('submission_id')
        return AdditionalInvoiceFee.objects.filter(submission_id=submission_id).order_by('-created_at')
    
    def perform_create(self, serializer):
        fee = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created additional fee: {fee}")


# ============================================================================
# WORKFLOW ACTION VIEWS
# ============================================================================

class SubmissionWorkflowView(APIView):
    """
    POST: Trigger workflow actions for submissions
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, submission_id):
        try:
            submission = Submission.objects.get(pk=submission_id)
        except Submission.DoesNotExist:
            return Response({"error": "Submission not found"}, status=HTTP_404_NOT_FOUND)
        
        action = request.data.get('action')
        
        if action == 'advance_phase':
            return self.advance_phase(request, submission)
        elif action == 'generate_certificate':
            return self.generate_certificate(request, submission)
        elif action == 'generate_invoice':
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
                {"error": f"Cannot advance from phase {submission.get_phase_display()}"}, 
                status=HTTP_400_BAD_REQUEST
            )
        
        submission.phase = next_phase
        submission.save()
        
        settings.LOGGER.info(f"User {request.user} advanced submission {submission.case_number} to {next_phase}")
        
        return Response({
            "message": f"Submission advanced to {submission.get_phase_display()}",
            "new_phase": next_phase
        }, status=HTTP_200_OK)
    
    def generate_certificate(self, request, submission):
        """Generate certificate for submission"""
        # Check if certificate already exists
        if submission.certificates.exists():
            return Response(
                {"error": "Certificate already exists for this submission"}, 
                status=HTTP_400_BAD_REQUEST
            )
        
        # Create certificate
        certificate = Certificate.objects.create(submission=submission)
        submission.certificates_generated_at = timezone.now()
        submission.save(update_fields=['certificates_generated_at'])
        
        settings.LOGGER.info(f"User {request.user} generated certificate {certificate.certificate_number}")
        
        return Response({
            "message": "Certificate generated successfully",
            "certificate_number": certificate.certificate_number
        }, status=HTTP_201_CREATED)
    
    def generate_invoice(self, request, submission):
        """Generate invoice for submission"""
        customer_number = request.data.get('customer_number')
        if not customer_number:
            return Response(
                {"error": "Customer number is required"}, 
                status=HTTP_400_BAD_REQUEST
            )
        
        # Create invoice
        invoice = Invoice.objects.create(
            submission=submission,
            customer_number=customer_number
        )
        submission.invoices_generated_at = timezone.now()
        submission.save(update_fields=['invoices_generated_at'])
        
        settings.LOGGER.info(f"User {request.user} generated invoice {invoice.invoice_number}")
        
        return Response({
            "message": "Invoice generated successfully",
            "invoice_number": invoice.invoice_number,
            "total": str(invoice.total)
        }, status=HTTP_201_CREATED)