from django.db import models

from common.models import AuditModel


class PoliceStation(AuditModel):
    name = models.CharField(
        max_length=200,
        verbose_name=("Police Station Name"),
        help_text=("Name of the Police Station / Organisation"),
    )
    address = models.TextField(
        blank=True,
        null=True,
        help_text="Police Station address",
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Police Station phone number",
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Police Station"
        verbose_name_plural = "Police Stations"


class PoliceOfficer(AuditModel):
    badge_number = models.CharField(
        max_length=20,
        blank=True,  # have to because bad data
        null=True,
        help_text="Officer's badge number",
    )
    first_name = models.CharField(
        max_length=100,
        null=True,  # have to because bad data
        blank=True,
        verbose_name=("First Name"),
        help_text=("First name or given names."),
    )
    last_name = models.CharField(
        max_length=100,
        null=True,  # have to because bad data
        blank=True,
        verbose_name=("Last Name"),
        help_text=("Last name or surname."),
    )

    # Determine if is_sworn based on seniority
    class SeniorityChoices(models.TextChoices):
        # Standard ranks (based on actual cannabis data analysis)
        UNKNOWN = "unknown", "Unknown"  # have to because bad data
        UNSWORN_OFFICER = "unsworn_officer", "Unsworn Officer"  # 1820 occurrences
        SWORN_OFFICER = "sworn_officer", "Sworn Officer"  # 2107 occurrences

        # Constable ranks
        CONSTABLE = "constable", "Constable"  # 2 occurrences
        POLICE_CONSTABLE = "police_constable", "Police Constable"  # 160 occurrences
        FIRST_CLASS_CONSTABLE = (
            "first_class_constable",
            "First Class Constable",
        )  # 104 occurrences
        SENIOR_CONSTABLE = "senior_constable", "Senior Constable"  # 756 occurrences

        # Detective ranks
        DETECTIVE = "detective", "Detective"  # 228 occurrences
        DETECTIVE_FIRST_CLASS_CONSTABLE = (
            "detective_first_class_constable",
            "Detective First Class Constable",
        )  # 1 occurrence
        DETECTIVE_SENIOR_CONSTABLE = (
            "detective_senior_constable",
            "Detective Senior Constable",
        )  # 13 occurrences
        SENIOR_DETECTIVE = "senior_detective", "Senior Detective"  # 1 occurrence

        # Higher ranks
        SERGEANT = "sergeant", "Sergeant"  # 24 occurrences
        INSPECTOR = "inspector", "Inspector"  # 1 occurrence

        # Data quality issues - map to OTHER for malformed ranks with names mixed in
        OTHER = "other", "Other"

    rank = models.CharField(
        choices=SeniorityChoices.choices,
        default=SeniorityChoices.UNKNOWN,
        max_length=50,
    )

    # Direct foreign key relationship
    station = models.ForeignKey(
        PoliceStation,
        on_delete=models.SET_NULL,
        null=True,  # have to because bad data
        blank=True,
        related_name="officers",
        help_text="The police station this officer is assigned to",
    )

    @property
    def full_name(self):
        """Return officer's full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name or "Unknown Officer"

    @property
    def is_sworn(self):
        """Determine if officer is sworn based on rank"""
        unsworn_ranks = [
            self.SeniorityChoices.UNKNOWN,
            self.SeniorityChoices.UNSWORN_OFFICER,
            self.SeniorityChoices.OTHER,
        ]
        return self.rank not in unsworn_ranks

    def __str__(self):
        station_info = f" at {self.station.name}" if self.station else ""
        return f"{self.full_name} ({self.get_rank_display()}){station_info}"

    class Meta:
        verbose_name = "Police Officer"
        verbose_name_plural = "Police Officers"
