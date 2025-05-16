from django.db import models

from backend.common.models import CommonModel


# Create your models here.
class Submission(CommonModel):

    dbca_submitter = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="submissions",
        null=False,
    )

    police_officer = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="submissions_as_officer",
    )

    police_submitter = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="submissions_on_behalf",
    )

    # bags =

    # marked =

    # suspected =

    # security_movement_envelope =

    # assessment_date =

    def __str__(self):
        return f"Avatar for {f"{self.id}-{self.submitter}-{self.created_at}"}"

    class Meta:
        ordering = ["-created_at"]


class Baggy(CommonModel):

    class ItemType(models.TextChoices):
        SEED = "seed", "Seed/s"
        SEEDLING = "seedling", "Seedling/s"
        PLANT = "plant", "Plant/s"
        PLANT_STRIKING = "plant_striking", "Plant Striking/s"
        POPPY_CAPSULE = (
            "poppy_capsule",
            "Poppy Capsule/s",
        )  # poppy head/seed is seed or seedling? are these all referring to same thing?
        STEM = "stem", "Stem/s"  # root, stalk, stump, tin difference?
        ROOT_BALL = "root_ball", "Root Ball/s"
        MUSHROOM = "mushroom", "Mushroom/s"
        TIN = "tin", "Tin/s"
        UNKNOWN = "unknown", "Unknown"

    # item = Will always be Cannabis
    item_type = models.CharField(
        choices=ItemType.choices,
        default=ItemType.PLANT,
        null=False,
    )

    units = models.PositiveIntegerField(null=False, blank=False)

    police_reference_number = models.CharField(
        max_length=17,
    )  # aaaaaa aaaa aaaaa/bbbb (property_reference and property number)
    police_property_number = models.CharField(
        max_length=4,
        blank=False,
        null=False,
    )

    seal_no = models.CharField(
        max_length=50,
        blank=False,
        null=False,
    )
    new_seal_no = models.CharField(
        max_length=50,
        blank=False,
        null=False,
    )

    class DeterminationOptions(models.TextChoices):
        DEGRADED = "degraded", "Degraded"
        CANNABIS = "cannabis", "Cannabis Sativa"

    # botanist_determination =


class Certificate(CommonModel):
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        null=False,
        blank=False,
    )
    identification_fee = models.PositiveIntegerField(
        default=10,  # $ per bag
        blank=False,
        null=False,
    )

    # Accessed via submission
    # baggies = models.ForeignKey(
    #     "submissions.Baggy",
    #     on_delete=models.SET_NULL,
    #     blank=False,
    #     null=False,
    # )

    # Calculated based on identification fee * baggies
    # total_fee = models.PositiveIntegerField(
    #     default=10,
    #     blank=False,
    #     null=False
    # )

    # certificate_number =  (autogen)
    # reference_number = ?

    # certified date is created_at
