from django.urls import path
from . import views

urlpatterns = [
    path("settings/", views.SystemSettingsView.as_view(), name="system-settings"),
    path("security-monitoring/", views.SecurityMonitoringView.as_view(), name="security-monitoring"),
    path("reset-rate-limits/", views.ResetRateLimitsView.as_view(), name="reset-rate-limits"),
]
