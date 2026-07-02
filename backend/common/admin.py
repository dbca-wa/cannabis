from django.contrib import admin

from .models import SystemSettings


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
            "Feature Flags",
            {
                "fields": ("ocr_enabled",),
            },
        ),
        (
            "Counters",
            {
                "fields": ("batch_counter",),
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
