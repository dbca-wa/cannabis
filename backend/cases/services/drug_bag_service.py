"""Drug bag service — drug bag and botanical assessment business logic.

Handles drug bag CRUD operations and botanical assessment creation/update logic.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

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

        Raises:
            ValidationError: If an assessment already exists.
        """
        if BotanicalAssessment.objects.filter(drug_bag=drug_bag).exists():
            raise ValidationError("Assessment already exists for this drug bag.")

    @staticmethod
    def create_assessment(drug_bag, data, user):
        """Create a botanical assessment for a drug bag.

        Validates that no assessment already exists, then creates the record.

        Args:
            drug_bag: The DrugBag instance.
            data: Validated assessment data dict.
            user: The user creating the assessment.

        Returns:
            The newly created BotanicalAssessment instance.

        Raises:
            ValidationError: If assessment already exists.
        """
        DrugBagService.validate_assessment_creation(drug_bag, user)

        assessment = BotanicalAssessment.objects.create(drug_bag=drug_bag, **data)

        settings.LOGGER.info(
            f"User {user} created assessment for bag " f"{drug_bag.seal_tag_numbers}"
        )

        return assessment

    @staticmethod
    def validate_assessment_update_permission(user):
        """Validate that the user can update botanical assessments.

        Any authenticated user with a role can update assessments.
        """
        # No role restriction — IsAuthenticated on the view is sufficient

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

    @staticmethod
    @transaction.atomic
    def batch_create(submission, bags_data, user):
        """Create multiple bags with assessments in a single transaction.

        Tag-uniqueness validation (within the batch and against existing bags)
        is handled by DrugBagBatchCreateSerializer before this runs.

        Args:
            submission: The Case instance.
            bags_data: List of dicts with keys: seal_tag_numbers, new_seal_tag_numbers,
                       content_type, determination, assessment_date.
            user: The user performing the creation.

        Returns:
            List of created DrugBag instances (with nested assessment).
        """
        # Create all bags and assessments
        created_bags = []
        for entry in bags_data:
            bag = DrugBag.objects.create(
                submission=submission,
                seal_tag_numbers=entry["seal_tag_numbers"],
                new_seal_tag_numbers=entry.get("new_seal_tag_numbers") or "",
                content_type=entry.get("content_type", DrugBag.ContentType.PLANT),
            )

            determination = entry.get("determination")
            if determination and determination != "pending":
                BotanicalAssessment.objects.create(
                    drug_bag=bag,
                    determination=determination,
                    assessment_date=entry.get("assessment_date") or timezone.now(),
                )

            created_bags.append(bag)

        settings.LOGGER.info(
            f"User {user} batch-created {len(created_bags)} bags "
            f"for case {submission.case_number}"
        )

        # Refresh to include nested assessment relations
        bag_ids = [bag.pk for bag in created_bags]
        return list(
            DrugBag.objects.filter(pk__in=bag_ids)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )
