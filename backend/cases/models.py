from decimal import Decimal

from django.db import models

from common.models import AuditModel, SystemSettings


class Case(AuditModel):
    """
    A case / request for determination, containing multiple baggies.
    Renamed from Submission for domain clarity.
    """

    # potentially add status like paid/cancelled/delivered

    # ETL tracking
    legacy_id = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Original row_id from ETL processing for cannabis data import",
    )

    # Officers
    approved_botanist = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="botanist_cases",
        help_text="The approved botanist handling this case",
        limit_choices_to={"role": "botanist"},
    )
    finance_officer = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finance_cases",
        help_text="The finance officer handling this case",
        limit_choices_to={"role": "finance"},
    )
    requesting_officer = models.ForeignKey(
        "police.PoliceOfficer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases_requested",
        help_text="The original officer requesting the case",
    )
    submitting_officer = models.ForeignKey(
        "police.PoliceOfficer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases_made",
        help_text="The officer submitting on behalf of requesting officer",
    )

    station = models.ForeignKey(
        "police.PoliceStation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="case_involvement",
        help_text="The station this case is for",
    )

    # Case details
    case_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Unique case identifier (can be empty for drafts)",
    )
    received = models.DateTimeField(
        help_text="When the submission was received",
    )

    # Defendants (many-to-many since multiple defendants can be in one case)
    defendants = models.ManyToManyField(
        "defendants.Defendant",
        related_name="cases",
        blank=True,
        help_text="Defendants involved in this case",
    )

    # Workflow phase - 5-phase state machine
    class PhaseChoices(models.TextChoices):
        ASSESSMENT = "assessment", "Assessment"
        UNSIGNED_GENERATION = "unsigned_generation", "Unsigned Certificate"
        BATCHING = "batching", "Batching"
        IN_BATCH = "in_batch", "In Batch"
        COMPLETE = "complete", "Complete"

    phase = models.CharField(
        max_length=30,
        choices=PhaseChoices.choices,
        default=PhaseChoices.ASSESSMENT,
        help_text="Current phase of the case workflow",
    )

    security_movement_envelope = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Security Movement Envelope",
        help_text="Security Movement Envelope number for the bags (can be empty for drafts)",
    )

    internal_comments = models.TextField(
        blank=True,
        null=True,
        verbose_name="Internal Comments",
        help_text="Any internal comments not showing on certificate",
    )

    additional_notes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Additional Notes",
        help_text="Section C certificate content (additional notes for the examining botanist)",
    )

    # Optional scanned Priority 3 police form this case was created from.
    # Stored in Azure Blob in production; never required (kept for reference).
    police_form = models.FileField(
        upload_to="police_forms/",
        blank=True,
        null=True,
        verbose_name="Police Priority 3 Form",
        help_text="Optional scanned Priority 3 form used to create this case",
    )

    # Legacy flag — ETL-imported historical cases that predate the current
    # workflow. These are in the Complete phase and have no certificates or
    # batches; they exist for reference and reporting only.
    is_legacy = models.BooleanField(
        default=False,
        help_text="True for ETL-imported historical cases that predate the current workflow.",
    )

    # Workflow timestamps
    certificates_generated_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    # Batching — a case belongs to at most one batch
    batch = models.ForeignKey(
        "submissions.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases",
        help_text="The batch this case has been included in, if any",
    )

    # Tracks the user who last actioned (moved/edited) the case
    last_actioned_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="last_actioned_cases",
        help_text="User who last performed a workflow action on this case",
    )

    @property
    def is_batch_eligible(self):
        """A case is eligible for batching when it has reached the Batching
        phase and is not already attached to a batch."""
        return self.phase == self.PhaseChoices.BATCHING and self.batch_id is None

    @property
    def cannabis_present(self):
        """Check if any bag contains cannabis"""
        return self.bags.filter(
            assessment__determination__icontains="cannabis"
        ).exists()

    @property
    def bags_received(self):
        """Count of bags received"""
        return self.bags.count()

    @property
    def total_plants(self):
        """Total plant specimens across all bags (count of bags)"""
        return self.bags.count()

    def __str__(self):
        return f"Case {self.case_number} - {self.get_phase_display()}"

    class Meta:
        verbose_name = "Case"
        verbose_name_plural = "Cases"
        ordering = ["-received"]
        db_table = "submissions_case"


class CasePhaseHistory(AuditModel):
    """Track all phase transitions for audit trail"""

    submission = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="phase_history",
        help_text="The case this history entry belongs to",
    )

    from_phase = models.CharField(
        max_length=30,
        choices=Case.PhaseChoices.choices,
        help_text="Phase the case was in before this transition",
    )

    to_phase = models.CharField(
        max_length=30,
        choices=Case.PhaseChoices.choices,
        help_text="Phase the case moved to",
    )

    action = models.CharField(
        max_length=20,
        choices=[
            ("advance", "Advanced"),
        ],
        help_text="Type of action that caused this transition",
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="case_phase_actions",
        help_text="User who performed this action",
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text="When this transition occurred",
    )

    def __str__(self):
        user_text = self.user.get_full_name() if self.user else "System"
        return f"{self.submission.case_number}: {user_text} advanced from {self.get_from_phase_display()} to {self.get_to_phase_display()}"

    class Meta:
        verbose_name = "Phase History Entry"
        verbose_name_plural = "Phase History Entries"
        ordering = ["-timestamp"]
        db_table = "submissions_casephasehistory"
        indexes = [
            models.Index(fields=["submission", "-timestamp"]),
        ]


class DrugBag(AuditModel):
    """
    A bag received from police potentially containing cannabis
    """

    submission = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="bags",
        help_text="The case this bag belongs to",
    )

    class ContentType(models.TextChoices):
        PLANT = "plant", "Plant Material"
        PLANT_MATERIAL = "plant_material", "Plant Material (Generic)"
        CUTTING = "cutting", "Cutting"
        STALK = "stalk", "Stalk"
        STEM = "stem", "Stem"
        SEED = "seed", "Seed"
        SEED_MATERIAL = "seed_material", "Seed Material"
        UNKNOWN_SEED = "unknown_seed", "Unknown Seed"
        SEEDLING = "seedling", "Seedling"
        HEAD = "head", "Head"
        ROOTBALL = "rootball", "Rootball"
        POPPY = "poppy", "Poppy"
        POPPY_PLANT = "poppy_plant", "Poppy Plant"
        POPPY_CAPSULE = "poppy_capsule", "Poppy Capsule"
        POPPY_HEAD = "poppy_head", "Poppy Head"
        POPPY_SEED = "poppy_seed", "Poppy Seed"
        MUSHROOM = "mushroom", "Mushroom"
        TABLET = "tablet", "Tablet"
        UNKNOWN = "unknown", "Unknown"
        UNSURE = "unsure", "Unsure"

    content_type = models.CharField(
        choices=ContentType.choices,
        max_length=20,
        default=ContentType.PLANT,
    )

    # Bag identification
    seal_tag_numbers = models.CharField(
        max_length=100,
        verbose_name="Original Tag Number",
        help_text="Original Drug Movement Bag tag number",
    )
    new_seal_tag_numbers = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="New Tag Number",
        help_text="New Drug Movement Bag tag number (if resealed)",
    )
    property_reference = models.CharField(
        blank=True,
        null=True,
        max_length=20,
        verbose_name="Property Reference",
        help_text="Police property reference number",
    )

    # Weight measurements (optional - data shows some reference to weight)
    gross_weight = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        blank=True,
        null=True,
        help_text="Total weight including bag/container (grams)",
    )
    net_weight = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        blank=True,
        null=True,
        help_text="Weight of specimens only (grams)",
    )

    @property
    def security_movement_envelope(self):
        """Get envelope number from parent submission"""
        return self.submission.security_movement_envelope

    def __str__(self):
        return f"Bag {self.seal_tag_numbers} - {self.submission.case_number}"

    class Meta:
        verbose_name = "Drug Bag"
        verbose_name_plural = "Drug Bags"
        unique_together = ["submission", "seal_tag_numbers"]


class BotanicalAssessment(AuditModel):
    """
    Botanical assessment results for each drug bag
    """

    drug_bag = models.OneToOneField(
        DrugBag,
        on_delete=models.CASCADE,
        related_name="assessment",
        help_text="The drug bag being assessed",
    )

    class DeterminationChoices(models.TextChoices):
        PENDING = "pending", "Pending Assessment"
        # Cannabis identifications
        CANNABIS_SATIVA = "cannabis_sativa", "Cannabis sativa"
        CANNABIS_INDICA = "cannabis_indica", "Cannabis indica"
        CANNABIS_HYBRID = "cannabis_hybrid", "Cannabis (hybrid)"
        MIXED = "mixed", "Mixed"  # Mixed cannabis cases from data
        # Non-cannabis botanical identifications
        PAPAVER_SOMNIFERUM = "papaver_somniferum", "Papaver somniferum"  # Opium poppy
        # Assessment outcomes
        DEGRADED = "degraded", "Degraded"
        NOT_CANNABIS = "not_cannabis", "Not Cannabis"
        UNIDENTIFIABLE = (
            "unidentifiable",
            "Unidentifiable",
        )  # From data: cases where ID wasn't possible
        INCONCLUSIVE = "inconclusive", "Inconclusive"  # unsure/not enough sample etc

    determination = models.CharField(
        max_length=50,  # Increased to accommodate "papaver_somniferum" and future additions
        choices=DeterminationChoices.choices,
        blank=True,
        null=True,
        help_text="Botanical determination result",
    )

    assessment_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date and time when the botanical assessment was performed",
    )

    botanist_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Detailed notes from botanical assessment",
    )

    @property
    def is_cannabis(self):
        """Check if determination is any type of cannabis"""
        cannabis_types = [
            self.DeterminationChoices.CANNABIS_SATIVA,
            self.DeterminationChoices.CANNABIS_INDICA,
            self.DeterminationChoices.CANNABIS_HYBRID,
            self.DeterminationChoices.MIXED,  # Mixed cannabis cases
        ]
        return self.determination in cannabis_types

    @property
    def is_controlled_substance(self):
        """Check if determination is any controlled substance (cannabis or poppy)"""
        controlled_substances = [
            self.DeterminationChoices.CANNABIS_SATIVA,
            self.DeterminationChoices.CANNABIS_INDICA,
            self.DeterminationChoices.CANNABIS_HYBRID,
            self.DeterminationChoices.MIXED,
            self.DeterminationChoices.PAPAVER_SOMNIFERUM,  # Opium poppy
        ]
        return self.determination in controlled_substances

    def __str__(self):
        determination = (
            self.get_determination_display() if self.determination else "Not assessed"
        )
        return f"{self.drug_bag} - {determination}"

    class Meta:
        verbose_name = "Botanical Assessment"
        verbose_name_plural = "Botanical Assessments"


class Certificate(AuditModel):
    """Generated certificates for submission drug bags"""

    submission = models.ForeignKey(
        "submissions.Case",
        on_delete=models.CASCADE,
        related_name="certificates",
    )

    # The specific drug bags this certificate covers (max 5 enforced in service)
    bags = models.ManyToManyField(
        "submissions.DrugBag",
        related_name="certificates",
        blank=True,
        help_text="The drug bags covered by this certificate (up to 5)",
    )

    certificate_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,  # Will be auto-generated
        help_text="Auto-generated certificate number (e.g., CRT2024-001)",
    )

    # Date the certificate was certified (rendered on the PDF)
    certified_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date the certificate was certified, shown on the PDF",
    )

    # Section C content for this specific certificate (per-certificate notes)
    additional_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Section C 'other matters' notes shown on this certificate",
    )

    pdf_generating = models.BooleanField(
        default=False,
        help_text="Whether PDF is currently being generated",
    )

    # Final certificate PDF (single deliverable — no separate signed version)
    pdf_file = models.FileField(
        upload_to="certificates/",
        blank=True,
        null=True,
        help_text="Generated certificate PDF",
    )
    pdf_size = models.PositiveIntegerField(
        default=0,
        help_text="Size of the certificate PDF in bytes",
    )

    def save(self, *args, **kwargs):
        """Auto-generate certificate number on creation."""
        if not self.certificate_number:
            settings_obj = SystemSettings.load()
            self.certificate_number = settings_obj.get_next_certificate_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Certificate {self.certificate_number} - {self.submission.case_number}"

    class Meta:
        verbose_name = "Certificate"
        verbose_name_plural = "Certificates"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission", "-created_at"]),
            models.Index(fields=["certificate_number"]),
        ]


class Batch(AuditModel):
    """A batch groups one or more completed-unsigned cases for cost tallying
    and document packaging. Replaces the per-case invoice workflow."""

    batch_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,  # Auto-generated on creation
        help_text="Auto-generated batch number (e.g., BATCH2025-001)",
    )

    # Snapshot of the rates current at batch creation time
    cert_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Certificate rate captured at batch time",
    )
    bag_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Bag identification rate captured at batch time",
    )
    tax_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Tax percentage captured at batch time",
    )

    # Denormalised tallies for fast sorting/listing
    certificate_count = models.PositiveIntegerField(
        default=0,
        help_text="Total certificates across all cases in the batch",
    )
    bag_count = models.PositiveIntegerField(
        default=0,
        help_text="Total drug bags across all cases in the batch",
    )

    # Computed money (using the snapshot rates)
    cert_cost = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    bag_cost = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    subtotal = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    tax_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    total = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )

    certificate_number_range = models.TextField(
        blank=True,
        help_text="Comma-separated certificate numbers for the batch",
    )

    # Invoice raised on Oracle — entered later on the Batches page; unique.
    # When set, the batch's cases are marked complete.
    invoice_raised_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        unique=True,
        help_text="Unique Oracle invoice-raised number; completing the cases",
    )
    invoice_raised_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the invoice-raised number was recorded",
    )

    # Downloadable package (certificates + cost summary)
    zip_file = models.FileField(
        upload_to="batches/",
        blank=True,
        null=True,
        help_text="Generated ZIP package of certificates and cost summary",
    )
    zip_size = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_batches",
        help_text="User who created the batch",
    )

    def save(self, *args, **kwargs):
        """Auto-generate batch number on creation."""
        if not self.batch_number:
            settings_obj = SystemSettings.load()
            self.batch_number = settings_obj.get_next_batch_number()
        super().save(*args, **kwargs)

    @property
    def is_invoiced(self):
        """Whether an invoice-raised number has been recorded."""
        return bool(self.invoice_raised_number)

    def __str__(self):
        return f"Batch {self.batch_number} ({self.certificate_count} certs)"

    class Meta:
        verbose_name = "Batch"
        verbose_name_plural = "Batches"
        ordering = ["-created_at"]
        db_table = "submissions_batch"
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["batch_number"]),
        ]


class CaseDraft(AuditModel):
    """Stores serialised wizard state for draft persistence. One per user."""

    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="case_draft",
    )
    data = models.JSONField(default=dict)
    current_step = models.IntegerField(default=0)

    class Meta:
        verbose_name = "Case Draft"
        verbose_name_plural = "Case Drafts"
        db_table = "submissions_casedraft"

    def __str__(self) -> str:
        return f"Draft for {self.user}"


# Backward-compatible aliases for the rename transition
Submission = Case
SubmissionDraft = CaseDraft
SubmissionPhaseHistory = CasePhaseHistory
