from django.urls import path
from . import views

urlpatterns = [
    # User Avatar
    path("avatar/", views.UserAvatar.as_view()),
    path("avatar/detail/", views.UserAvatarDetail.as_view()),
    path("certificates", views.CertificatePDFList.as_view()),
    path("certificates/<int:id>", views.CertificatePDFDetail.as_view()),
]
