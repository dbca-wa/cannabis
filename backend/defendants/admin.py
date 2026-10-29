from django.contrib import admin
from django.db.models import Count
from django.urls import reverse
from django.utils.html import format_html

from common.admin_mixins import CreatorListFilter, PracticeAwareAdminMixin

from .models import Defendant


@admin.register(Defendant)
class DefendantAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "pdf_name",
        "case_count",
        "created_by",
        "created_at",
    )
    # Lists only users who have created a defendant, plus "-" for rows with no
    # recorded creator.
    list_filter = (
        ("created_by", CreatorListFilter),
        "created_at",
    )
    list_select_related = ("created_by",)
    search_fields = (
        "given_names",
        "last_name",
        "created_by__email",
        "created_by__given_names",
        "created_by__last_name",
    )
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
            "Record history",
            {
                "fields": ("created_by", "created_at", "updated_by", "updated_at"),
            },
        ),
    )

    readonly_fields = ("created_by", "created_at", "updated_by", "updated_at")

    def save_model(self, request, obj, form, change):
        # Record who created or last edited the defendant through the admin
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        # Annotate once so the changelist doesn't issue a count query per row
        return super().get_queryset(request).annotate(_case_count=Count("cases"))

    @admin.display(description="Cases", ordering="_case_count")
    def case_count(self, obj):
        """Count of cases this defendant is involved in, linked to the case list"""
        count = obj._case_count
        if count > 0:
            case_opts = Defendant.cases.rel.related_model._meta
            return format_html(
                '<a href="{}?defendants__id__exact={}">{} case{}</a>',
                reverse(
                    f"admin:{case_opts.app_label}_{case_opts.model_name}_changelist"
                ),
                obj.pk,
                count,
                "" if count == 1 else "s",
            )
        return "No cases"
