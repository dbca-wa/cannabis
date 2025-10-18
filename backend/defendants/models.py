from django.db import models
from common.models import AuditModel


class Defendant(AuditModel):
    """
    Defendants involved in cannabis-related cases
    """

    first_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name=("First Name"),
        help_text=("First name or given names."),
    )
    last_name = models.CharField(
        max_length=100,
        verbose_name=("Last Name"),
        help_text=("Last name or surname."),
    )

    @property
    def pdf_name(self):
        if self.last_name and self.first_name:
            return f"{self.last_name.capitalize()}, {self.first_name.capitalize()}"
        return self.last_name.capitalize() if self.last_name else "Unknown"

    @property
    def full_name(self):
        """Return defendant's full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.last_name or "Unknown"

    def __str__(self):
        return f"{self.id} - {self.full_name}"

    class Meta:
        verbose_name = "Defendant"
        verbose_name_plural = "Defendants"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["last_name"]),
            models.Index(fields=["first_name"]),
            models.Index(fields=["last_name", "first_name"]),
        ]
