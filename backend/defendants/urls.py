from django.urls import path

from . import views

urlpatterns = [
    # Defendant endpoints
    path("list", views.DefendantListCreateView.as_view(), name="defendant_list"),
    path("merge", views.DefendantMergeView.as_view(), name="defendant_merge"),
    path("export", views.DefendantExportView.as_view(), name="defendant_export"),
    path(
        "test", views.DefendantExportView.as_view(), name="defendant_test"
    ),  # Test endpoint
    path(
        "<int:pk>",
        views.DefendantRetrieveUpdateDestroyView.as_view(),
        name="defendant_detail",
    ),
]
