from django.db import models

from common.models import CommonModel


class PoliceStation(CommonModel):
    # Bare minimum, model entry requires name
    name = models.CharField(
        blank=False,
        null=False,
        unique=True,
    )
    # Optional
    address = models.CharField(
        blank=True,
        null=True,
        max_length=200,
    )
    phone_number = models.CharField(
        blank=True,
        null=True,
        max_length=20,
    )
    email = models.CharField(
        blank=True,
        null=True,
        max_length=60,
    )

    # created_at, updated_at

    def __str__(self):
        return self.name


class PoliceStationMembership(CommonModel):
    # Delete entry if station removed
    station = models.ForeignKey(
        "organisations.PoliceStation",
        on_delete=models.CASCADE,
        related_name="memberships",  # Good practice to add a related_name
    )

    # Delete entry if user removed
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="police_station_membership",  # Good practice to add a related_name
    )

    # created_at, updated_at

    def __str__(self):
        return f"{self.user}|{self.station}"

    class Meta:
        unique_together = (
            "user",
            "station",
        )  # Ensure a user can only be a member of one station (if that's your requirement)
