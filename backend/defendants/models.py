from django.db import models

from common.models import AuditModel
from common.practice import (
    IS_PRACTICE_HELP,
    RealManager,
    practice_owner_field,
)


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

    is_practice = models.BooleanField(default=False, help_text=IS_PRACTICE_HELP)
    practice_owner = practice_owner_field("practice_defendants")

    objects = RealManager()
    all_objects = models.Manager()

    @property
    def pdf_name(self):
        if self.last_name and self.given_names:
            return f"{self.last_name.upper()}, {self.given_names.title()}"
        return self.last_name.upper() if self.last_name else "Unknown"

    @property
    def full_name(self):
        """The defendant's name as shown everywhere in the app: SURNAME, Given.

        Surname first in capitals, matching the Priority 3 form and the
        certificate, so a name reads the same in every list, picker and
        message.
        """
        last = (self.last_name or "").strip()
        given = (self.given_names or "").strip()
        if last and given:
            return f"{last.upper()}, {given}"
        return last.upper() or "Unknown"

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
