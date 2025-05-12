from django.urls import path
from . import views

urlpatterns = [
    # User Avatar
    path("avatar/", views.UserAvatar.as_view()),
    path("avatar/detail/", views.UserAvatarDetail.as_view()),
]
