from django.urls import path
from . import views

urlpatterns = [
    path("", views.Users.as_view()),
    path("<int:id>", views.UserDetail.as_view()),
    path("whoami/", views.WhoAmI.as_view()),
    # path("register", views.Register.as_view()),
    path("search/", views.UserSearch.as_view()),
]
