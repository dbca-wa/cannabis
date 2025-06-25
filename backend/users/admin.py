from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.forms import ValidationError

from users.models import DBCAStaffProfile, PoliceStaffProfile, User


# Inline admin classes for profiles
class DBCAStaffProfileInline(admin.StackedInline):
    model = DBCAStaffProfile
    can_delete = True  # Allow deletion to switch profile types
    verbose_name_plural = "DBCA Staff Profile"
    extra = 0
    max_num = 1  # Only allow one profile

    def get_extra(self, request, obj=None, **kwargs):
        """Don't show extra form if user already has a police profile"""
        if obj and hasattr(obj, "police_staff_profile"):
            return 0
        return self.extra


class PoliceStaffProfileInline(admin.StackedInline):
    model = PoliceStaffProfile
    can_delete = True  # Allow deletion to switch profile types
    verbose_name_plural = "Police Staff Profile"
    extra = 0
    max_num = 1  # Only allow one profile

    def get_extra(self, request, obj=None, **kwargs):
        """Don't show extra form if user already has a DBCA profile"""
        if obj and hasattr(obj, "dbca_staff_profile"):
            return 0
        return self.extra


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines = (DBCAStaffProfileInline, PoliceStaffProfileInline)
    fieldsets = (
        (
            "Profile",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "username",
                    "email",
                    "password",
                ),
                "classes": ("wide",),
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_superuser",
                    "is_staff",
                    "is_active",
                    "groups",
                    "user_permissions",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Important dates",
            {
                "fields": ("last_login", "date_joined"),
                "classes": ("collapse",),
            },
        ),
    )
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "get_user_role",
    )

    def get_user_role(self, obj):
        """Get the user's role from their profile"""
        try:
            profile = obj.dbca_staff_profile
            return f"DBCA: {profile.get_role_display()}"
        except DBCAStaffProfile.DoesNotExist:
            pass

        try:
            profile = obj.police_staff_profile
            return f"Police: {profile.get_seniority_display()}"
        except PoliceStaffProfile.DoesNotExist:
            pass

        return "No Role Assigned"

    get_user_role.short_description = "Role"

    # Optional: Add role filtering
    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("dbca_staff_profile", "police_staff_profile")
        )

    def save_model(self, request, obj, form, change):
        """Custom save to validate profile constraints"""
        super().save_model(request, obj, form, change)

        # Check if user has both profiles after saving
        has_dbca = hasattr(obj, "dbca_staff_profile")
        has_police = hasattr(obj, "police_staff_profile")

        if has_dbca and has_police:
            # This should be prevented by the UI, but add server-side validation
            raise ValidationError(
                "User cannot have both DBCA and Police profiles. "
                "Please delete one profile before saving."
            )


# Register profile models separately for direct editing
@admin.register(DBCAStaffProfile)
class DBCAStaffProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "it_asset_id", "employee_id")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "it_asset_id", "employee_id")
    autocomplete_fields = ("user",)


@admin.register(PoliceStaffProfile)
class PoliceStaffProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "seniority", "police_id", "sworn", "station_membership")
    list_filter = ("seniority", "sworn")
    search_fields = ("user__username", "user__email", "police_id")
    autocomplete_fields = ("user",)
