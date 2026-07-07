from datetime import datetime, timezone
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class AuditModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        related_name="%(class)s_created",
        on_delete=models.SET_NULL,
        null=True,
    )

    updated_by = models.ForeignKey(
        "users.User",
        related_name="%(class)s_updated",
        on_delete=models.SET_NULL,
        null=True,
    )
    deleted_by = models.ForeignKey(
        "users.User",
        related_name="%(class)s_deleted",
        on_delete=models.SET_NULL,
        null=True,
    )

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        """Mark record as deleted"""
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=["deleted_at", "updated_at", "deleted_by"])
        if user:
            self.updated_by = user
            self.deleted_by = user
            self.save(
                update_fields=[
                    "deleted_at",
                    "updated_by",
                    "updated_at",
                ]
            )
        else:
            self.save(
                update_fields=[
                    "deleted_at",
                    "updated_at",
                ]
            )


class SystemSettings(models.Model):
    """
    Singleton model for system-wide settings
    Only one instance should exist
    """

    # Pricing
    cost_per_certificate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("110.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Cost per certificate in dollars",
    )
    cost_per_bag = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("11.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Cost per bag identification in dollars",
    )
    tax_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("100.00")),
        ],
        help_text="Tax percentage (e.g., 10.00 for 10%)",
    )

    # Email settings
    forward_certificate_emails_to = models.EmailField(
        default=(
            getattr(settings, "ENVELOPE_EMAIL_RECIPIENTS", ["admin@example.com"])[0]
            if hasattr(settings, "ENVELOPE_EMAIL_RECIPIENTS")
            and settings.ENVELOPE_EMAIL_RECIPIENTS
            else "jarid.prince@dbca.wa.gov.au"
        ),
        help_text="Fallback recipient for system emails (invites, password reset)",
    )

    # Development/Testing email settings
    send_emails_to_self = models.BooleanField(
        default=True,  # Will be overridden by get_default_send_emails_to_self
        help_text="Send invitation emails to the admin instead of actual recipients (for testing)",
    )
    email_testing_mode = models.BooleanField(
        default=False,
        help_text="When enabled, all emails are redirected to the test user",
    )
    email_test_user = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="email_test_settings",
        help_text="User who receives all emails when testing mode is enabled",
    )

    # Feature flags
    ocr_enabled = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, the Priority 3 form OCR upload appears on case "
            "creation and processing to optionally prefill case data."
        ),
    )

    # Auto-incrementing counters
    certificate_counter = models.PositiveIntegerField(
        default=1,
        help_text="Next certificate number to assign",
    )
    batch_counter = models.PositiveIntegerField(
        default=1,
        help_text="Next batch number to assign",
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who last modified these settings",
    )
    last_modified_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp of last modification",
    )

    def save(self, *args, **kwargs):
        """Ensure only one SystemSettings instance exists"""
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Prevent deletion of SystemSettings"""

    @classmethod
    def get_default_send_emails_to_self(cls):
        """Get default value for send_emails_to_self based on environment"""
        environment = getattr(settings, "ENVIRONMENT", "local").lower()

        if environment == "production":
            return False  # Always send to actual recipients in production
        elif environment == "staging":
            return True  # Default to self in staging, but allow toggle
        else:  # local, development
            return True  # Always send to self in development

    @classmethod
    def is_send_emails_to_self_editable(cls):
        """Check if send_emails_to_self field should be editable"""
        getattr(settings, "ENVIRONMENT", "local").lower()

        # Editable in all environments for testing purposes
        # In local/development, it's useful to toggle for testing
        # In staging/production, it's needed for proper email routing control
        return True

    @classmethod
    def load(cls):
        """Get or create the singleton SystemSettings instance"""
        obj, created = cls.objects.get_or_create(pk=1)

        # Set default value based on environment if newly created
        if created:
            obj.send_emails_to_self = cls.get_default_send_emails_to_self()
            obj.save()

        return obj

    def get_next_certificate_number(self):
        """Generate and return the next certificate number in R{nnnnnn} format.

        Always 6 digits zero-padded (e.g., R000001, R000032, R005000).
        """
        self.certificate_counter += 1
        self.save(update_fields=["certificate_counter"])
        return f"R{self.certificate_counter:06d}"

    def get_next_batch_number(self):
        """Generate and return next batch number"""
        year = datetime.now().year
        batch_num = f"BATCH{year}-{self.batch_counter:03d}"
        self.batch_counter += 1
        self.save(update_fields=["batch_counter"])
        return batch_num

    def __str__(self):
        return "System Settings"

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"
