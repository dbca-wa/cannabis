from django.db import models

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    # To override default django, use same field and set editable to false
    # first_name = models.CharField(max_length=150, blank=True, editable=False)
    it_asset_id = models.PositiveIntegerField(
        blank=True,
        null=True,
    )
    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )
    is_approved_botanist = models.BooleanField(default=False)
    is_finance_officer = models.BooleanField(default=False)
