from django.contrib import admin
from .models import PoliceStation, PoliceStationMembership


@admin.register(PoliceStation)
class PoliceStationAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "created_at")
    list_filter = ("created_at",)
    search_fields = ("name",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")


@admin.register(PoliceStationMembership)
class PoliceStationMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "station", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
