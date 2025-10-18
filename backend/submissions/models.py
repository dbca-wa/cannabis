from random import choice
from django.db import models
from common.models import AuditModel, SystemSettings


from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class Submission(AuditModel):
    """
    A submission / request for determination, containing multiple baggies
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
        related_name="botanist_submissions",
        help_text="The approved botanist handling this submission",
        limit_choices_to={"role": "botanist"},
    )
    finance_officer = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finance_submissions",
        help_text="The finance officer handling this submission",
        limit_choices_to={"role": "finance"},
    )
    requesting_officer = models.ForeignKey(
        "police.PoliceOfficer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions_requested",
        help_text="The original officer requesting the submission",
    )
    submitting_officer = models.ForeignKey(
        "police.PoliceOfficer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions_made",
        help_text="The officer submitting on behalf of requesting officer",
    )

    station = models.ForeignKey(
        "police.PoliceStation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission_involvement",
        help_text="The station submission is for",
    )

    # Case details
    case_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique case identifier",
    )
    received = models.DateTimeField(
        help_text="When the submission was received",
    )

    # Defendants (many-to-many since multiple defendants can be in one case)
    defendants = models.ManyToManyField(
        "defendants.Defendant",
        related_name="submissions",
        blank=True,
        help_text="Defendants involved in this case",
    )

    # Draft status - for work-in-progress submissions
    is_draft = models.BooleanField(
        default=True,
        help_text="Whether this submission is a draft (work-in-progress)",
    )

    # Workflow phase - Updated to 6-phase workflow
    class PhaseChoices(models.TextChoices):
        DATA_ENTRY = "data_entry", "Data Entry"
        FINANCE_APPROVAL = "finance_approval", "Finance Approval"
        BOTANIST_REVIEW = "botanist_review", "Botanist Review"
        DOCUMENTS = "documents", "Documents"
        SEND_EMAILS = "send_emails", "Send Emails"
        COMPLETE = "complete", "Complete"

    phase = models.CharField(
        max_length=30,
        choices=PhaseChoices.choices,
        default=PhaseChoices.DATA_ENTRY,
        help_text="Current phase of the submission workflow",
    )

    security_movement_envelope = models.CharField(
        max_length=20,
        verbose_name="Security Movement Envelope",
        help_text="Security Movement Envelope number for the bags",
    )

    internal_comments = models.TextField(
        blank=True,
        null=True,
        verbose_name="Internal Comments",
        help_text="Any internal comments not showing on certificate",
    )

    # Finance-related fields (for invoice calculation)
    forensic_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Number of forensic hours (e.g., 2.5 for 2 hours 30 minutes)",
    )
    fuel_distance_km = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Distance traveled in kilometers for fuel cost calculation",
    )

    # Workflow timestamps
    finance_approved_at = models.DateTimeField(blank=True, null=True)
    botanist_approved_at = models.DateTimeField(blank=True, null=True)
    certificates_generated_at = models.DateTimeField(blank=True, null=True)
    invoices_generated_at = models.DateTimeField(blank=True, null=True)
    emails_sent_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

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
        verbose_name = "Submission"
        verbose_name_plural = "Submissions"
        ordering = ["-received"]


class SubmissionPhaseHistory(AuditModel):
    """Track all phase transitions for audit trail"""

    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="phase_history",
        help_text="The submission this history entry belongs to",
    )

    from_phase = models.CharField(
        max_length=30,
        choices=Submission.PhaseChoices.choices,
        help_text="Phase the submission was in before this transition",
    )

    to_phase = models.CharField(
        max_length=30,
        choices=Submission.PhaseChoices.choices,
        help_text="Phase the submission moved to",
    )

    action = models.CharField(
        max_length=20,
        choices=[
            ("advance", "Advanced"),
            ("send_back", "Sent Back"),
        ],
        help_text="Type of action that caused this transition",
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="submission_phase_actions",
        help_text="User who performed this action",
    )

    reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for send-back actions",
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text="When this transition occurred",
    )

    def __str__(self):
        action_text = "sent back" if self.action == "send_back" else "advanced"
        user_text = self.user.get_full_name() if self.user else "System"
        return f"{self.submission.case_number}: {user_text} {action_text} from {self.get_from_phase_display()} to {self.get_to_phase_display()}"

    class Meta:
        verbose_name = "Phase History Entry"
        verbose_name_plural = "Phase History Entries"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["submission", "-timestamp"]),
        ]


class DrugBag(AuditModel):
    """
    A bag received from police potentially containing cannabis
    """

    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="bags",
        help_text="The submission this bag belongs to",
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
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="certificates",
    )

    certificate_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,  # Will be auto-generated
        help_text="Auto-generated certificate number (e.g., CRT2024-001)",
    )

    pdf_generating = models.BooleanField(
        default=False,
        help_text="Whether PDF is currently being generated",
    )
    pdf_file = models.FileField(
        upload_to="certificates/",
        blank=True,
        null=True,
        help_text="Generated PDF certificate",
    )
    pdf_size = models.PositiveIntegerField(
        default=0,
        help_text="Size of the PDF in bytes",
    )

    def save(self, *args, **kwargs):
        """Auto-generate certificate number on creation"""
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


class Invoice(AuditModel):
    """Generated invoices for submissions"""

    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="invoices",
    )

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,  # Will be auto-generated
        help_text="Auto-generated invoice number (e.g., INV2024-001)",
    )

    customer_number = models.CharField(
        max_length=20,
        help_text="Customer reference number",
    )

    # Calculated totals
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Subtotal before tax",
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Tax amount",
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total amount including tax",
    )

    pdf_generating = models.BooleanField(
        default=False,
        help_text="Whether PDF is currently being generated",
    )
    pdf_file = models.FileField(
        upload_to="invoices/",  # Fixed: was pointing to certificates/
        blank=True,
        null=True,
        help_text="Generated PDF invoice",
    )
    pdf_size = models.PositiveIntegerField(
        default=0,
        help_text="Size of the PDF in bytes",
    )

    def save(self, *args, **kwargs):
        """Auto-generate invoice number and calculate totals"""
        if not self.invoice_number:
            settings_obj = SystemSettings.load()
            self.invoice_number = settings_obj.get_next_invoice_number()

        # Calculate totals if not set
        if self.subtotal == 0:
            self.calculate_totals()

        super().save(*args, **kwargs)

    def calculate_totals(self):
        """Calculate invoice totals based on certificates and additional fees"""
        settings_obj = SystemSettings.load()

        # Base cost: certificates + bag identification
        bag_count = self.submission.bags.count()
        bag_cost = bag_count * settings_obj.cost_per_bag
        cert_count = self.submission.certificates.count()
        certificate_cost = cert_count * settings_obj.cost_per_certificate

        # Additional fees
        additional_cost = Decimal("0.00")
        for fee in self.submission.additional_fees.all():
            if fee.claim_kind == AdditionalInvoiceFee.FeeChoices.FUEL:
                additional_cost += fee.units * settings_obj.cost_per_kilometer_fuel
            elif fee.claim_kind == AdditionalInvoiceFee.FeeChoices.FORENSIC:
                additional_cost += fee.units * settings_obj.cost_per_forensic_hour
            elif fee.claim_kind == AdditionalInvoiceFee.FeeChoices.CALL_OUT:
                # You might want to add a call_out_fee to SystemSettings
                additional_cost += fee.units * Decimal("50.00")  # Default call out fee

        self.subtotal = certificate_cost + bag_cost + additional_cost
        self.tax_amount = self.subtotal * (settings_obj.tax_percentage / 100)
        self.total = self.subtotal + self.tax_amount

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.submission.case_number}"

    class Meta:
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission", "-created_at"]),
            models.Index(fields=["invoice_number"]),
        ]


class AdditionalInvoiceFee(AuditModel):
    """Additional fees that can be added to invoices"""

    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="additional_fees",
        help_text="The submission this fee relates to",
    )

    class FeeChoices(models.TextChoices):
        FUEL = "fuel", "Fuel/Travel"
        CALL_OUT = "call_out", "Call Out"
        FORENSIC = "forensic", "Forensic Work"

    claim_kind = models.CharField(
        max_length=20,
        choices=FeeChoices.choices,
        help_text="Type of additional fee",
    )

    units = models.PositiveIntegerField(
        default=1,
        help_text="Number of units (km for fuel, hours for forensic, times for call out)",
    )

    description = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Optional description of the fee",
    )

    @property
    def calculated_cost(self):
        """Calculate the cost of this fee based on current system settings"""
        settings_obj = SystemSettings.load()

        if self.claim_kind == self.FeeChoices.FUEL:
            return self.units * settings_obj.cost_per_kilometer_fuel
        elif self.claim_kind == self.FeeChoices.FORENSIC:
            return self.units * settings_obj.cost_per_forensic_hour
        elif self.claim_kind == self.FeeChoices.CALL_OUT:
            # You might want to add this to SystemSettings
            return self.units * Decimal("50.00")  # Default call out fee

        return Decimal("0.00")

    def __str__(self):
        unit_text = {
            self.FeeChoices.FUEL: "km",
            self.FeeChoices.FORENSIC: "hours",
            self.FeeChoices.CALL_OUT: "times",
        }.get(self.claim_kind, "units")

        return f"{self.get_claim_kind_display()}: {self.units} {unit_text}"

    class Meta:
        verbose_name = "Additional Invoice Fee"
        verbose_name_plural = "Additional Invoice Fees"
