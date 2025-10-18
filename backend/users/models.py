from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver


# For putting the email and username together/requiring email
class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier"""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password"""
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


# This is for DBCA users only, currently no plans to expand system out to police
class User(AbstractUser):
    """
    Custom User Model where email is used as the username
    """

    # Remove the inherited username field completely
    username = None

    email = models.EmailField(
        ("email address"),
        unique=True,
        max_length=254,
    )

    # Base details (also pulled from it assets when invited if not admin)
    first_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name=("First Name"),
        help_text=("First name or given name."),
    )
    last_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name=("Last Name"),
        help_text=("Last name or surname."),
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

    # IT assets stuff
    it_asset_id = models.PositiveIntegerField(
        blank=True,
        null=True,
    )
    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    # Set email as the username field
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # Email is already required as USERNAME_FIELD

    # Use custom manager
    objects = UserManager()

    @property
    def get_preferences(self):
        """Get user preferences, creating default if none exist"""
        preferences, created = UserPreferences.objects.get_or_create(user=self)
        return preferences

    @property
    def full_name(self):
        """Get user's full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email.split("@")[0]

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.email}"


class UserPreferences(models.Model):
    """
    Unique User Preferences per user
    """

    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="preferences",
        help_text="The user these preferences belong to",
    )

    # Theme preferences
    class ThemeChoices(models.TextChoices):
        LIGHT = "light", "Light Mode"
        DARK = "dark", "Dark Mode"
        SYSTEM = "system", "System"

    theme = models.CharField(
        max_length=10,
        choices=ThemeChoices.choices,
        default=ThemeChoices.SYSTEM,
        help_text="User's preferred theme",
    )

    # Display preferences
    class DisplayModeChoices(models.TextChoices):
        GRID = "grid", "Grid View"
        LIST = "list", "List View"

    submissions_display_mode = models.CharField(
        max_length=10,
        choices=DisplayModeChoices.choices,
        default=DisplayModeChoices.LIST,
        help_text="How to display submissions",
    )

    certificates_display_mode = models.CharField(
        max_length=10,
        choices=DisplayModeChoices.choices,
        default=DisplayModeChoices.LIST,
        help_text="How to display certificates",
    )

    # Pagination preferences
    class ItemsPerPageChoices(models.IntegerChoices):
        TEN = 10, "10 items"
        TWENTY_FIVE = 25, "25 items"
        FIFTY = 50, "50 items"
        ONE_HUNDRED = 100, "100 items"

    items_per_page = models.IntegerField(
        choices=ItemsPerPageChoices.choices,
        default=ItemsPerPageChoices.TWENTY_FIVE,
        help_text="Number of items to show per page",
    )

    # Notification preferences
    email_notifications = models.BooleanField(
        default=True,
        help_text="Receive email notifications",
    )

    comment_notifications = models.BooleanField(
        default=True,
        help_text="Notify when a submission you are involved in receives a comment",
    )

    reaction_notifications = models.BooleanField(
        default=True, help_text="Notify when a comment you made is reacted to"
    )

    notify_submission_assigned = models.BooleanField(
        default=True,
        help_text="Notify when a submission is assigned to you",
    )

    notify_phase_changes = models.BooleanField(
        default=True,
        help_text="Notify when submission phase changes",
    )

    notify_certificate_generated = models.BooleanField(
        default=True,
        help_text="Notify when certificates are generated",
    )

    notify_invoices_generated = models.BooleanField(
        default=True,
        help_text="Notify when invoices are generated",
    )

    notify_pdfs_mailed = models.BooleanField(
        default=True,
        help_text="Notify when pdfs sent to client",
    )
    # test email functionality - sends to self to see how client would see

    # Accessibility preferences (additional, down the line)

    # colourblind = models.BooleanField(
    #     default=False,
    #     help_text="Enable Colourblind mode"
    # )

    # If text is too small
    # large_text = models.BooleanField(
    #     default=False,
    #     help_text="Use larger text size",
    # )

    # For floating cannabis animations
    reduce_motion = models.BooleanField(
        default=False,
        help_text="Reduce animations and motion",
    )

    # Created/Updated timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Frontend UI preferences (for cross-device sync)
    class LoaderStyleChoices(models.TextChoices):
        COOK = "cook", "Cook Loader"
        BASE = "base", "Base Loader"
        MINIMAL = "minimal", "Minimal Loader"

    loader_style = models.CharField(
        max_length=10,
        choices=LoaderStyleChoices.choices,
        default=LoaderStyleChoices.MINIMAL,
        help_text="Preferred loading animation style",
    )

    # Search and filter preferences (JSON field for flexibility)
    default_search_settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Default search and filter settings for various pages",
    )

    # Table-specific filter preferences (JSON field for data table persistence)
    table_filter_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="Persistent filter and sort preferences for data tables (officers, stations, users)",
    )

    # General UI preferences (JSON field for extensibility)
    ui_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional UI preferences and settings",
    )

    # Date/Time preferences
    class DateFormatChoices(models.TextChoices):
        DMY = "d/m/Y", "DD/MM/YYYY"
        MDY = "m/d/Y", "MM/DD/YYYY"
        YMD = "Y-m-d", "YYYY-MM-DD"
        DMY_VERBOSE = "d F Y", "DD Month YYYY"

    date_format = models.CharField(
        max_length=10,
        choices=DateFormatChoices.choices,
        default=DateFormatChoices.DMY,
        help_text="Preferred date format",
    )

    class TimeFormatChoices(models.TextChoices):
        TWELVE = "g:i A", "12-hour (2:30 PM)"
        TWENTY_FOUR = "H:i", "24-hour (14:30)"

    time_format = models.CharField(
        max_length=10,
        choices=TimeFormatChoices.choices,
        default=TimeFormatChoices.TWELVE,
        help_text="Preferred time format",
    )

    # Utility methods
    def is_dark_mode(self):
        """Check if user prefers dark mode"""
        return self.theme == self.ThemeChoices.DARK

    def get_css_theme_class(self):
        """Get CSS class for theme"""
        return f"{self.theme}"

    def get_display_preferences(self):
        """Get all display mode preferences as a dict"""
        return {
            "submissions": self.submissions_display_mode,
            "certificates": self.certificates_display_mode,
        }

    def get_notification_settings(self):
        """Get notification preferences as a dict"""
        return {
            "email": self.email_notifications,
            "comments": self.comment_notifications,
            "reactions": self.reaction_notifications,
            "assigned": self.notify_submission_assigned,
            "phase_changes": self.notify_phase_changes,
            "certificates": self.notify_certificate_generated,
            "invoices": self.notify_invoices_generated,
            "sent": self.notify_pdfs_mailed,
        }

    def __str__(self):
        return f"{self.user.full_name} Preferences"

    class Meta:
        verbose_name = "User Preferences"
        verbose_name_plural = "User Preferences"


# Create preferences on user creation


@receiver(post_save, sender=User)
def create_user_preferences(sender, instance, created, **kwargs):
    """Create UserPreferences when User is created"""
    if created:
        UserPreferences.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_preferences(sender, instance, **kwargs):
    """Save UserPreferences when User is saved"""
    if hasattr(instance, "preferences"):
        instance.preferences.save()


# JWT stuff
class RefreshToken(models.Model):
    """Track refresh tokens for additional security"""

    user = models.ForeignKey(
        get_user_model(), on_delete=models.CASCADE, related_name="refresh_tokens"
    )
    token = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_blacklisted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
