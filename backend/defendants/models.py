from django.db import models

from common.models import AuditModel


class Defendant(AuditModel):
    """
    Defendants involved in cannabis-related cases
    """

    given_names = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name=("Given Names"),
        help_text=("Given names (may be multiple, e.g. 'Van Ngoc')."),
    )
    last_name = models.CharField(
        max_length=100,
        verbose_name=("Last Name"),
        help_text=("Last name or surname."),
    )

    @property
    def pdf_name(self):
        if self.last_name and self.given_names:
            return f"{self.last_name.capitalize()}, {self.given_names.capitalize()}"
        return self.last_name.capitalize() if self.last_name else "Unknown"

    @property
    def full_name(self):
        """Return defendant's full name"""
        if self.given_names and self.last_name:
            return f"{self.given_names} {self.last_name}"
        return self.last_name or "Unknown"

    def __str__(self):
        return f"{self.id} - {self.full_name}"

    class Meta:
        verbose_name = "Defendant"
        verbose_name_plural = "Defendants"
        ordering = ["last_name", "given_names"]
        indexes = [
            models.Index(fields=["last_name"]),
            models.Index(fields=["given_names"]),
            models.Index(fields=["last_name", "given_names"]),
        ]
