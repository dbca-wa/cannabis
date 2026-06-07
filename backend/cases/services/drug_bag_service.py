"""Drug bag service — drug bag and botanical assessment business logic.

Handles drug bag CRUD operations and botanical assessment creation/update logic.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ..models import BotanicalAssessment, DrugBag


class DrugBagService:
    """Business logic for drug bag and botanical assessment operations."""

    @staticmethod
    def get_drug_bag(pk):
        """Retrieve a drug bag by primary key.

        Raises:
            NotFound: If the drug bag does not exist.
        """
        try:
            return (
                DrugBag.objects.select_related("submission")
                .prefetch_related("assessment")
                .get(pk=pk)
            )
        except DrugBag.DoesNotExist:
            raise NotFound(f"Drug bag with pk {pk} not found.")

    @staticmethod
    def get_submission_bags(submission_id):
        """Retrieve all drug bags for a given submission.

        Returns:
            QuerySet of DrugBag instances ordered by seal_tag_numbers.
        """
        return (
            DrugBag.objects.filter(submission_id=submission_id)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )

    @staticmethod
    def validate_assessment_creation(drug_bag, user):
        """Validate that a botanical assessment can be created for the drug bag.

        Checks:
        - The drug bag does not already have an assessment.
        - The user is a botanist or staff.

        Raises:
            ValidationError: If an assessment already exists.
            PermissionDenied: If the user is not permitted.
        """
        if hasattr(drug_bag, "assessment") and drug_bag.assessment is not None:
            raise ValidationError("Assessment already exists for this drug bag.")

        if not (user.role == "botanist" or user.is_staff):
            raise PermissionDenied("Only botanists can create assessments.")

    @staticmethod
    def create_assessment(drug_bag, data, user):
        """Create a botanical assessment for a drug bag.

        Validates permissions, creates the assessment record.

        Args:
            drug_bag: The DrugBag instance.
            data: Validated assessment data dict.
            user: The user creating the assessment.

        Returns:
            The newly created BotanicalAssessment instance.

        Raises:
            ValidationError: If assessment already exists.
            PermissionDenied: If user is not a botanist/staff.
        """
        DrugBagService.validate_assessment_creation(drug_bag, user)

        assessment = BotanicalAssessment.objects.create(drug_bag=drug_bag, **data)

        settings.LOGGER.info(
            f"Botanist {user} created assessment for bag "
            f"{drug_bag.seal_tag_numbers}"
        )

        return assessment

    @staticmethod
    def validate_assessment_update_permission(user):
        """Validate that the user can update botanical assessments.

        Raises:
            PermissionDenied: If the user is not a botanist or staff.
        """
        if not (user.role == "botanist" or user.is_staff):
            raise PermissionDenied("Only botanists can update assessments.")

    @staticmethod
    def update_assessment_with_auto_date(assessment, validated_data):
        """Update an assessment, auto-setting assessment_date if determination is set.

        If the determination field is being set for the first time and
        assessment_date is not already set, auto-populate it with now().

        Args:
            assessment: The BotanicalAssessment instance.
            validated_data: The validated data to apply.

        Returns:
            The updated BotanicalAssessment instance.
        """
        if validated_data.get("determination") and not assessment.assessment_date:
            validated_data["assessment_date"] = timezone.now()

        for key, value in validated_data.items():
            setattr(assessment, key, value)
        assessment.save()

        return assessment
