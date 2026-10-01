from django.apps import AppConfig


class PoliceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "police"

    def ready(self):
        from common.practice import connect_practice_stamping

        from .models import PoliceOfficer, PoliceStation

        connect_practice_stamping(PoliceOfficer, PoliceStation)
