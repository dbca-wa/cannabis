from django.urls import path
from . import views

urlpatterns = [
    # Submissions endpoints
    path("", views.Submissions.as_view(), name="submissions-list"),
    path("<int:id>/", views.SubmissionDetail.as_view(), name="submission-detail"),
    # Baggies endpoints
    path("baggies/", views.Baggies.as_view(), name="baggies-list"),
    path("baggies/<int:id>/", views.BaggyDetail.as_view(), name="baggy-detail"),
    # Certificates endpoints
    path("certificates/", views.Certificates.as_view(), name="certificates-list"),
    path(
        "certificates/<int:id>/",
        views.CertificateDetail.as_view(),
        name="certificate-detail",
    ),
]
