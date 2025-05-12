from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "auth"
    label = "custom_auth"  # Using a custom label to avoid conflicts with Django's built-in auth app
