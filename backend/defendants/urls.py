from django.urls import path
from . import views


urlpatterns = [
    # Defendant endpoints
    path("", views.DefendantListCreateView.as_view(), name="defendant_list"),
    path("export/", views.DefendantExportView.as_view(), name="defendant_export"),
    path(
        "test/", views.DefendantExportView.as_view(), name="defendant_test"
    ),  # Test endpoint
    path(
        "<int:pk>/",
        views.DefendantRetrieveUpdateDestroyView.as_view(),
        name="defendant_detail",
    ),
]
