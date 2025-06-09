from django.urls import path
from . import views


urlpatterns = [
    path("", views.Users.as_view()),
    path("<int:id>", views.UserDetail.as_view()),
    path("whoami", views.WhoAmI.as_view()),
    # Register handled by dbca
    path("login", views.Login.as_view()),
    path("logout", views.Logout.as_view()),
    path("search", views.UserSearch.as_view()),
    path("csrf", views.CSRFToken.as_view(), name="csrf_token"),
]
