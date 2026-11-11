"""Police views package.

Re-exports all view classes so that existing imports like
``from . import views`` followed by ``views.PoliceStationListView`` continue to work.
"""

from .officers import (  # noqa: F401
    OfficerMergeView,
    PoliceOfficerDetailView,
    PoliceOfficerExportView,
    PoliceOfficerListView,
    PoliceOfficerUsageView,
)
from .stations import (  # noqa: F401
    PoliceStationDetailView,
    PoliceStationExportView,
    PoliceStationListView,
    PoliceStationUsageView,
    StationMergeView,
)

__all__ = [
    "PoliceStationListView",
    "PoliceStationDetailView",
    "PoliceStationExportView",
    "PoliceStationUsageView",
    "StationMergeView",
    "PoliceOfficerListView",
    "PoliceOfficerDetailView",
    "PoliceOfficerExportView",
    "PoliceOfficerUsageView",
    "OfficerMergeView",
]
