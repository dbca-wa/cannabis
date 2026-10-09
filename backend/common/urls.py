from django.urls import path

from . import views

urlpatterns = [
    path("page-view", views.PageViewView.as_view(), name="page-view"),
    path("settings", views.SystemSettingsView.as_view(), name="system-settings"),
    path(
        "feature-flags",
        views.SystemFeatureFlagsView.as_view(),
        name="system-feature-flags",
    ),
    path(
        "security-monitoring",
        views.SecurityMonitoringView.as_view(),
        name="security-monitoring",
    ),
    path(
        "reset-rate-limits",
        views.ResetRateLimitsView.as_view(),
        name="reset-rate-limits",
    ),
]
