from django.urls import path
from . import views


urlpatterns = [
    path("", views.Submissions.as_view()),
    path("<int:id>", views.SubmissionDetail.as_view()),
]
