from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED
from rest_framework.views import APIView

from ..models import BotanicalAssessment, DrugBag
from ..serializers import (
    BotanicalAssessmentSerializer,
    DrugBagCreateSerializer,
    DrugBagSerializer,
)


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
        pk = self.kwargs.get("pk")
        return (
            DrugBag.objects.filter(submission_id=pk)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
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


class BotanicalAssessmentCreateView(APIView):
    """
    POST: Create botanical assessment for a drug bag
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, drug_bag_id):
        try:
            drug_bag = DrugBag.objects.get(pk=drug_bag_id)
        except DrugBag.DoesNotExist:
            raise NotFound("Drug bag not found.")

        # Check if assessment already exists
        if hasattr(drug_bag, "assessment"):
            raise ValidationError("Assessment already exists for this drug bag.")

        # Only botanists can create assessments
        if not (request.user.role == "botanist" or request.user.is_staff):
            raise PermissionDenied("Only botanists can create assessments.")

        serializer = BotanicalAssessmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(drug_bag=drug_bag)
            settings.LOGGER.info(
                f"Botanist {request.user} created assessment for bag {drug_bag.seal_tag_numbers}"
            )
            return Response(serializer.data, status=HTTP_201_CREATED)

        raise ValidationError(serializer.errors)


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
