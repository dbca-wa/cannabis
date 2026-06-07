"""Defendants views package.

Re-exports all view classes so that existing imports like
``from . import views`` followed by ``views.DefendantListCreateView`` continue to work.
"""

from .crud import (
    DefendantListCreateView,
    DefendantRetrieveUpdateDestroyView,
)
from .export import DefendantExportView
from .merge import DefendantMergeView

__all__ = [
    "DefendantListCreateView",
    "DefendantRetrieveUpdateDestroyView",
    "DefendantExportView",
    "DefendantMergeView",
]
