"""URL routing for the signatures API."""

from django.urls import path

from . import views

urlpatterns = [
    # Current user's signature
    path("me", views.MySignatureView.as_view(), name="my_signature"),
    path("me/image", views.MySignatureImageView.as_view(), name="my_signature_image"),
    # Other user's signature (staff only)
    path("<int:user_id>", views.UserSignatureView.as_view(), name="user_signature"),
    path(
        "<int:user_id>/image",
        views.UserSignatureImageView.as_view(),
        name="user_signature_image",
    ),
    # Audit logs
    path("audit", views.MyAuditLogView.as_view(), name="my_audit_log"),
    path(
        "audit/<int:user_id>",
        views.UserAuditLogView.as_view(),
        name="user_audit_log",
    ),
]
