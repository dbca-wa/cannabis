from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import Defendant


@admin.register(Defendant)
class DefendantAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "pdf_name", "submission_count", "created_at")
    search_fields = ("given_names", "last_name")
    ordering = ("last_name", "given_names")

    fieldsets = (
        (
            "Personal Information",
            {
                "fields": ("given_names", "last_name"),
                "classes": ("wide",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("created_at", "updated_at")

    def submission_count(self, obj):
        """Count of submissions this defendant is involved in"""
        count = obj.submissions.count()
        if count > 0:
            return format_html(
                '<a href="{}?defendants__id__exact={}">{} submissions</a>',
                reverse("admin:submissions_submission_changelist"),
                obj.id,
                count,
            )
        return "No submissions"

    submission_count.short_description = "Submissions"
