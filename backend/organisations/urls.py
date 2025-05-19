from django.urls import path
from . import views

urlpatterns = [
    # User Avatar
    path("", views.Organisations.as_view()),
    path("<int:id>", views.OrganisationDetail.as_view()),
]
