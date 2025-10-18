from django.urls import path
from . import views

urlpatterns = [
    path("settings/", views.SystemSettingsView.as_view(), name="system-settings"),
]
