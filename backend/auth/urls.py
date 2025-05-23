from django.urls import path
from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("signup/", views.SignupView.as_view(), name="signup"),
    path("token/refresh/", views.RefreshTokenView.as_view(), name="refresh_token"),
    path("token/verify/", views.VerifyTokenView.as_view(), name="verify_token"),
]
