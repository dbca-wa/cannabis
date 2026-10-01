"""URL routes for practice mode, mounted at /api/v1/practice/."""

from django.urls import path

from . import views

urlpatterns = [
    path("mode", views.PracticeModeView.as_view(), name="practice_mode"),
    path("brief", views.PracticeBriefView.as_view(), name="practice_brief"),
]
