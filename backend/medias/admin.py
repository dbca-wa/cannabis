from django.contrib import admin
from .models import UserAvatar


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
