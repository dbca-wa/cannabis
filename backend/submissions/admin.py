from django.contrib import admin

from users.models import User
from .models import Submission, Baggy, Certificate  # Import your models


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "submission",
        "created_at",
    )  # Customize the list view
    list_filter = ("created_at",)  # Add filters for date


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "dbca_submitter",
        "police_officer",
        "created_at",
    )
    list_filter = (
        "created_at",
        "dbca_submitter",
        "police_officer",
    )  # Add filters
    search_fields = (
        "id",
        "dbca_submitter__user__username",
        "police_officer__user__username",
    )  # Enable search

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "dbca_submitter":
            kwargs["queryset"] = User.objects.filter(dbcastaffprofile__isnull=False)
        elif db_field.name == "police_officer" or db_field.name == "police_submitter":
            kwargs["queryset"] = User.objects.filter(policestaffprofile__isnull=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Baggy)
class BaggyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "submission",
        "item_type",
        "units",
        "police_reference_number",
    )
    list_filter = ("item_type",)
    search_fields = (
        "police_reference_number",
        "police_property_number",
        "seal_no",
    )
