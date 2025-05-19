from django.contrib import admin
from .models import CertificatePDF, UserAvatar


@admin.register(UserAvatar)
class UserAvatarAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "deleted_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "user__email")
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Avatar Information",
            {
                "fields": ("user", "image"),
                "classes": ("wide",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at", "deleted_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("created_at", "updated_at")

    def get_queryset(self, request):
        # Include soft-deleted items in admin
        return UserAvatar.objects.all()


@admin.register(CertificatePDF)
class CertificatePDFAdmin(admin.ModelAdmin):
    list_display = ("certificate", "file", "size", "created_at")
    list_filter = ("created_at",)
    search_fields = (
        "certificate__id",
        "certificate__submission__id",
    )  # Search by related Certificate/Submission
    raw_id_fields = ("certificate",)  # Use raw ID field for the related Certificate
    readonly_fields = ("size", "created_at", "updated_at")

    fieldsets = (
        (
            "PDF Information",
            {
                "fields": ("certificate", "file", "size"),
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
