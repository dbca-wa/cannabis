from datetime import timezone, datetime
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


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
            self.save(update_fields=["deleted_at", "updated_by", "updated_at",])
        else:
            self.save(update_fields=["deleted_at", "updated_at",])



class SystemSettings(models.Model):
    """
    Singleton model for system-wide settings
    Only one instance should exist
    """
    
    # Pricing
    cost_per_certificate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('110.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Cost per certificate in dollars",
    )
    cost_per_bag = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('11.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Cost per bag identification in dollars",
    )
    cost_per_forensic_hour = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('200.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Cost per hour of forensic work in dollars",
    )
    cost_per_kilometer_fuel = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        default=Decimal('1.750'),
        validators=[MinValueValidator(Decimal('0.001'))],
        help_text="Cost per kilometer for fuel in dollars",
    )
    tax_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('10.00'),
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Tax percentage (e.g., 10.00 for 10%)",
    )
    
    # Email settings
    forward_certificate_emails_to = models.EmailField(
        default=getattr(settings, 'ENVELOPE_EMAIL_RECIPIENTS', ['admin@example.com'])[0]
        if hasattr(settings, 'ENVELOPE_EMAIL_RECIPIENTS') and settings.ENVELOPE_EMAIL_RECIPIENTS
        else 'jarid.prince@dbca.wa.gov.au',
        help_text="Email address to forward certificate notifications to",
    )
    
    # Auto-incrementing counters
    certificate_counter = models.PositiveIntegerField(
        default=1,
        help_text="Next certificate number to assign",
    )
    invoice_counter = models.PositiveIntegerField(
        default=1,
        help_text="Next invoice number to assign",
    )
    
    
    def save(self, *args, **kwargs):
        """Ensure only one SystemSettings instance exists"""
        self.pk = 1
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Prevent deletion of SystemSettings"""
        pass
    
    @classmethod
    def load(cls):
        """Get or create the singleton SystemSettings instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
    
    def get_next_certificate_number(self):
        """Generate and return next certificate number"""
        year = datetime.now().year
        cert_num = f"CRT{year}-{self.certificate_counter:03d}"
        self.certificate_counter += 1
        self.save(update_fields=['certificate_counter'])
        return cert_num
    
    def get_next_invoice_number(self):
        """Generate and return next invoice number"""
        year = datetime.now().year
        inv_num = f"INV{year}-{self.invoice_counter:03d}"
        self.invoice_counter += 1
        self.save(update_fields=['invoice_counter'])
        return inv_num
    
    def __str__(self):
        return "System Settings"
    

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"