"""Police serializers package."""

from .officer_serializer import (
    PoliceOfficerCreateSerializer,
    PoliceOfficerSerializer,
    PoliceOfficerTinySerializer,
)
from .station_serializer import (
    PoliceStationSerializer,
    PoliceStationTinySerializer,
)

__all__ = [
    "PoliceOfficerCreateSerializer",
    "PoliceOfficerSerializer",
    "PoliceOfficerTinySerializer",
    "PoliceStationSerializer",
    "PoliceStationTinySerializer",
]
