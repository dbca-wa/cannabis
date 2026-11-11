from django.urls import path

from . import views

urlpatterns = [
    # Police Station endpoints
    path("stations", views.PoliceStationListView.as_view(), name="station_list"),
    path(
        "stations/merge",
        views.StationMergeView.as_view(),
        name="station_merge",
    ),
    path(
        "stations/export",
        views.PoliceStationExportView.as_view(),
        name="station_export",
    ),
    path(
        "stations/<int:pk>",
        views.PoliceStationDetailView.as_view(),
        name="station_detail",
    ),
    path(
        "stations/<int:pk>/usage",
        views.PoliceStationUsageView.as_view(),
        name="station_usage",
    ),
    # Police Officer endpoints
    path("officers", views.PoliceOfficerListView.as_view(), name="officer_list"),
    path(
        "officers/export",
        views.PoliceOfficerExportView.as_view(),
        name="officer_export",
    ),
    path(
        "officers/merge",
        views.OfficerMergeView.as_view(),
        name="officer_merge",
    ),
    path(
        "officers/<int:pk>",
        views.PoliceOfficerDetailView.as_view(),
        name="officer_detail",
    ),
    path(
        "officers/<int:pk>/usage",
        views.PoliceOfficerUsageView.as_view(),
        name="officer_usage",
    ),
]
