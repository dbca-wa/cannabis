from django.contrib import admin

from .models import Signature, SignatureAuditLog


@admin.register(Signature)
class SignatureAdmin(admin.ModelAdmin):
    """Admin configuration for digital signatures."""

    list_display = (
        "id",
        "user",
        "content_type",
        "file_size",
        "width",
        "height",
        "file_hash_short",
        "created_at",
        "updated_at",
    )
    list_filter = ("content_type", "created_at")
    search_fields = (
        "user__email",
        "user__first_name",
        "user__last_name",
        "file_hash",
    )
    readonly_fields = ("file_hash", "created_at", "updated_at")
    ordering = ("-updated_at",)

    def file_hash_short(self, obj):
        """Truncated SHA-256 hash for readability."""
        if obj.file_hash:
            return f"{obj.file_hash[:12]}…"
        return "-"

    file_hash_short.short_description = "File Hash"


@admin.register(SignatureAuditLog)
class SignatureAuditLogAdmin(admin.ModelAdmin):
    """Read-only admin for the signature audit trail."""

    list_display = (
        "id",
        "user",
        "actor",
        "action",
        "content_type",
        "file_size",
        "file_hash_short",
        "timestamp",
    )
    list_filter = ("action", "timestamp")
    search_fields = (
        "user__email",
        "user__first_name",
        "user__last_name",
        "actor__email",
        "file_hash",
    )
    ordering = ("-timestamp",)
    readonly_fields = (
        "user",
        "actor",
        "action",
        "timestamp",
        "content_type",
        "file_size",
        "file_hash",
    )

    def file_hash_short(self, obj):
        """Truncated SHA-256 hash for readability."""
        if obj.file_hash:
            return f"{obj.file_hash[:12]}…"
        return "-"

    file_hash_short.short_description = "File Hash"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
