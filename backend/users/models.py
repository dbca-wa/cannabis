from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a user with the given email and password"""
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password"""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    # Make email required and unique
    email = models.EmailField(unique=True)

    # Set email as the username field
    USERNAME_FIELD = "email"

    # Since username comes from AbstractUser, it should be in REQUIRED_FIELDS
    # Also, email should NOT be in REQUIRED_FIELDS since it's the USERNAME_FIELD
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

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


class PoliceStaffProfile(models.Model):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="police_staff_profile",
    )
    police_id = models.CharField(
        max_length=40,
        blank=True,
        null=True,
    )
    station_membership = models.OneToOneField(
        "organisations.PoliceStationMembership",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="police_staff_profile",
    )

    class RoleChoices(models.TextChoices):
        POLICE_UNSWORN = "police_unsworn", "Police (Unsworn)"
        POLICE_SWORN = "police_sworn", "Police (Sworn)"
        NONE = "none", "None"

    role = models.CharField(
        choices=RoleChoices.choices,
        default=RoleChoices.NONE,
        max_length=20,
    )

    def __str__(self):
        return f"{self.user.username} (Police Staff: {self.get_role_display()})"
