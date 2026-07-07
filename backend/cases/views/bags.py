from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import BotanicalAssessment, DrugBag, Priority3Form
from ..serializers import (
    BotanicalAssessmentSerializer,
    DrugBagBatchCreateSerializer,
    DrugBagCreateSerializer,
    DrugBagSerializer,
)
from ..services import DrugBagService


class DrugBagListView(ListCreateAPIView):
    """
    GET: List drug bags for a specific submission
    POST: Create new drug bag
    """

    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DrugBagCreateSerializer
        return DrugBagSerializer

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return (
            DrugBag.objects.filter(form__case_id=pk)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )

    def perform_create(self, serializer):
        bag = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} created drug bag {bag.seal_tag_numbers} "
            f"for case {bag.form.case.case_number}"
        )


class DrugBagDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve drug bag details
    PUT/PATCH: Update drug bag
    DELETE: Delete drug bag
    """

    queryset = (
        DrugBag.objects.all()
        .select_related("form", "form__case")
        .prefetch_related("assessment")
    )
    serializer_class = DrugBagSerializer
    permission_classes = [HasAppAccess]

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

    permission_classes = [HasAppAccess]

    def post(self, request, drug_bag_id):
        try:
            drug_bag = DrugBag.objects.get(pk=drug_bag_id)
        except DrugBag.DoesNotExist:
            raise NotFound("Drug bag not found.")

        # Check if assessment already exists
        if BotanicalAssessment.objects.filter(drug_bag=drug_bag).exists():
            raise ValidationError("Assessment already exists for this drug bag.")

        # Any authenticated user can create assessments during case processing
        # (The view already requires app access via HasAppAccess)

        serializer = BotanicalAssessmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(drug_bag=drug_bag)
            settings.LOGGER.info(
                f"User {request.user} created assessment for bag {drug_bag.seal_tag_numbers}"
            )
            return Response(serializer.data, status=HTTP_201_CREATED)

        raise ValidationError(serializer.errors)


class BotanicalAssessmentDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve botanical assessment
    PUT/PATCH: Update assessment (botanists only)
    DELETE: Delete assessment
    """

    queryset = BotanicalAssessment.objects.all().select_related("drug_bag__form__case")
    serializer_class = BotanicalAssessmentSerializer
    permission_classes = [HasAppAccess]

    def check_object_permissions(self, request, obj):
        """Check permissions for assessment access"""
        super().check_object_permissions(request, obj)
        # Any authenticated user can update assessments during case processing

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
            f"User {self.request.user} updated assessment: {serializer.instance}"
        )


class DrugBagBatchCreateView(APIView):
    """Batch-create multiple drug bags (with optional assessments) on a form."""

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        try:
            form = Priority3Form.objects.select_related("case").get(pk=pk)
        except Priority3Form.DoesNotExist:
            raise NotFound("Priority 3 form not found.")

        serializer = DrugBagBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bags = DrugBagService.batch_create(
            form=form,
            bags_data=serializer.validated_data["bags"],
            user=request.user,
        )

        return Response(
            DrugBagSerializer(bags, many=True).data,
            status=HTTP_201_CREATED,
        )
