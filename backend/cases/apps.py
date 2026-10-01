from django.apps import AppConfig


class CasesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cases"
    label = "submissions"

    def ready(self):
        from common.practice import connect_practice_stamping

        from .models import (
            Batch,
            BotanicalAssessment,
            Case,
            Certificate,
            DrugBag,
            Priority3Form,
        )

        connect_practice_stamping(
            Case,
            Priority3Form,
            DrugBag,
            BotanicalAssessment,
            Certificate,
            Batch,
        )
