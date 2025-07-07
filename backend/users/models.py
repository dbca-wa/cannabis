from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.forms import ValidationError


class UserManager(BaseUserManager):
    """Custom user manager for username-based authentication with optional email"""

    def create_user(self, username, email=None, password=None, **extra_fields):
        """Create and save a user with the given username and optional email"""
        if not username:
            raise ValueError("The Username field must be set")

        # Normalise email if provided
        if email:
            email = self.normalize_email(email)

        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        """Create and save a superuser with the given username and optional email"""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    # Make email required and unique
    # email = models.EmailField(unique=True)

    # Make it optional, but unique - users will still need an email to login
    email = models.EmailField(unique=True, blank=True, null=True)

    # Set username as username field (swapped from email - problematic with external users w/o emails)
    USERNAME_FIELD = "email"

    # Email is not required for account creation anymore
    REQUIRED_FIELDS = ["email"] if False else []  # Empty required fields

    objects = UserManager()

    def clean(self):
        """Validate that user doesn't have both profile types"""
        super().clean()

        # Skip validation for new users (no pk yet)
        if not self.pk:
            return

        has_dbca = hasattr(self, "dbca_staff_profile")
        has_police = hasattr(self, "police_staff_profile")

        if has_dbca and has_police:
            raise ValidationError(
                "User cannot have both DBCA Staff and Police Staff profiles. "
                "Please choose only one profile type."
            )

    def save(self, *args, **kwargs):
        """Override save to run validation"""
        # Set email to None if it's empty string to maintain uniqueness
        if self.email == "":
            self.email = None
        self.clean()
        super().save(*args, **kwargs)

    def get_profile_type(self):
        """Get the type of profile this user has"""
        if hasattr(self, "dbca_staff_profile"):
            return "dbca"
        elif hasattr(self, "police_staff_profile"):
            return "police"
        return "none"

    def get_role_display(self):
        """Get the display name for the user's role"""
        if hasattr(self, "dbca_staff_profile"):
            return f"DBCA: {self.dbca_staff_profile.get_role_display()}"
        elif hasattr(self, "police_staff_profile"):
            return f"Police: {self.police_staff_profile.get_seniority_display()}"
        return "No Role Assigned"

    def get_display_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.username}"


class DBCAStaffProfile(models.Model):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="dbca_staff_profile",
    )
    it_asset_id = models.PositiveIntegerField(
        blank=True,
        null=True,
    )
    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    class RoleChoices(models.TextChoices):
        BOTANIST = "botanist", "Approved Botanist"
        FINANCE = "finance", "Finance Officer"
        NONE = "none", "None"

    role = models.CharField(
        choices=RoleChoices.choices,
        default=RoleChoices.NONE,
        max_length=20,
    )

    def __str__(self):
        return f"{self.user.username} (DBCA Staff: {self.get_role_display()})"

    def clean(self):
        """Validate that user doesn't already have a police profile"""
        super().clean()
        if hasattr(self.user, "police_staff_profile"):
            raise ValidationError(
                f"User {self.user.username} already has a Police Staff profile. "
                "Remove the Police profile before adding a DBCA profile."
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class PoliceStaffProfile(models.Model):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="police_staff_profile",
    )
    station_membership = models.OneToOneField(
        "organisations.PoliceStationMembership",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="police_staff_profile",
    )

    police_id = models.CharField(
        max_length=40,
        blank=True,
        null=True,
    )
    sworn = models.BooleanField(
        default=False,
    )

    class SeniorityChoices(models.TextChoices):
        UNSET = "unset", "Unset"
        OFFICER = "officer", "Officer"
        PROBATION_CONSTABLE = "probationary_constable", "Probationary Constable"
        CONSTABLE = "constable", "Cnstable"
        DETECTIVE = "detective", "Detective"
        FIRST_CLASS_CONSTABLE = "first_class_constable", "First Class Constable"
        SENIOR_CONSTABLE = "senior_constable", "Senior Constable"
        DETECTIVE_SENIOR_CONSTABLE = (
            "detective_senior_constable",
            "Detective Senior Constable",
        )
        CONVEYING_OFFICER = "conveying_officer", "Conveying Officer"

    seniority = models.CharField(
        choices=SeniorityChoices.choices,
        default=SeniorityChoices.OFFICER,
        max_length=30,
    )

    def __str__(self):
        return f"{self.user.username} (Police Staff: {self.get_seniority_display()})"

    def clean(self):
        """Validate that user doesn't already have a DBCA profile"""
        super().clean()
        if hasattr(self.user, "dbca_staff_profile"):
            raise ValidationError(
                f"User {self.user.username} already has a DBCA Staff profile. "
                "Remove the DBCA profile before adding a Police profile."
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
