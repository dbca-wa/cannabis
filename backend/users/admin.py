from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.forms import ValidationError

from users.models import User, UserPreferences, PasswordResetCode


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # Override ordering to use email instead of username
    ordering = ('email',)
    
    # Override list_filter to remove username-related filters
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'role', 'groups')
    
    # Override search_fields to use email instead of username
    search_fields = ('email', 'first_name', 'last_name')
    
    fieldsets = (
        (
            "Profile",
            {
                "fields": (
                    "email",
                    "password",
                    "first_name",
                    "last_name",
                    "role",
                ),
                "classes": ("wide",),
            },
        ),
        (
            "IT Assets Integration",
            {
                "fields": (
                    "it_asset_id",
                    "employee_id",
                ),
                "classes": ("collapse",),
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
    
    # Add fieldsets for user creation
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
        (
            "Profile Information",
            {
                "fields": ("first_name", "last_name", "role"),
                "classes": ("wide",),
            },
        ),
    )
    
    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "date_joined",
    )
    
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'role', 'groups')
    search_fields = ('email', 'first_name', 'last_name')


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ('user', 'theme', 'submissions_display_mode', 'certificates_display_mode', 'items_per_page', 'email_notifications', "reduce_motion",)
    list_filter = ('theme', 'email_notifications', 'reduce_motion',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name',)


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'expires_at', 'is_used', 'attempts', 'is_valid_display')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('code_hash', 'created_at', 'expires_at', 'used_at', 'is_expired', 'is_valid')
    ordering = ('-created_at',)
    
    def is_valid_display(self, obj):
        """Display whether the reset code is currently valid"""
        return obj.is_valid
    is_valid_display.boolean = True
    is_valid_display.short_description = 'Valid'
    
    def has_add_permission(self, request):
        """Prevent manual creation of reset codes through admin"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Allow viewing but prevent editing of reset codes"""
        return True
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion for cleanup purposes"""
        return True



# Inline admin for UserPreferences - potentially add to users as inline []
# class UserPreferencesInline(admin.StackedInline):
#     model = UserPreferences
#     can_delete = False
#     verbose_name_plural = 'Preferences'
#     fields = (
#         ('theme', 'reduce_motion'),
#         ('submissions_display_mode', 'certificates_display_mode'),
#         ('items_per_page', 'date_format', 'time_format'),
#         ('email_notifications', 'comment_notifications', 'reaction_notifications'),
#         ('notify_submission_assigned', 'notify_phase_changes'),
#         ('notify_certificate_generated', 'notify_invoices_generated', 'notify_pdfs_mailed'),
#     )
