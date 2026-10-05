from django.apps import AppConfig


class DefendantsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "defendants"
    verbose_name = "Defendants"

    def ready(self):
        from common.practice import connect_practice_stamping

        from .models import Defendant

        connect_practice_stamping(Defendant)
