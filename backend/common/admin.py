from django.contrib import admin
from django.contrib.admin.models import LogEntry

from .models import SystemSettings


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    """Read-only browser for the admin's own change history."""

    list_display = ("action_time", "user", "content_type", "object_repr", "action_flag")
    list_filter = ("action_flag", "content_type")
    search_fields = ("object_repr", "change_message", "user__email")
    date_hierarchy = "action_time"
    list_select_related = ("user", "content_type")
    readonly_fields = [f.name for f in LogEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Admin view for the singleton SystemSettings model."""

    list_display = (
        "cost_per_certificate",
        "cost_per_bag",
        "tax_percentage",
        "ocr_enabled",
        "email_testing_mode",
        "batch_counter",
    )

    fieldsets = (
        (
            "Pricing",
            {
                "fields": (
                    "cost_per_certificate",
                    "cost_per_bag",
                    "tax_percentage",
                ),
            },
        ),
        (
            "Email Settings",
            {
                "fields": (
                    "forward_certificate_emails_to",
                    "send_emails_to_self",
                    "email_testing_mode",
                    "email_test_user",
                ),
            },
        ),
        (
            "Defaults",
            {
                "fields": ("default_approved_botanist",),
            },
        ),
        (
            "Feature Flags",
            {
                "fields": ("ocr_enabled", "allow_saved_searches"),
            },
        ),
        (
            "Counters",
            {
                "fields": ("certificate_counter", "batch_counter"),
            },
        ),
        (
            "Audit",
            {
                "fields": ("last_modified_by", "last_modified_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("last_modified_by", "last_modified_at")

    def has_add_permission(self, request):
        # Singleton — only allow adding if none exists
        return not SystemSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
