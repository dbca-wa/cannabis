"""Cases serializers package."""

from .bags import (  # noqa: F401
    BotanicalAssessmentSerializer,
    DrugBagBatchCreateSerializer,
    DrugBagBatchItemSerializer,
    DrugBagCreateSerializer,
    DrugBagSerializer,
)
from .base import (  # noqa: F401
    CaseListSerializer,
    CaseSerializer,
    PoliceOfficerTinySerializer,
    UserTinySerializer,
)
from .certificates import CertificateSerializer  # noqa: F401
from .create import CaseCreateSerializer  # noqa: F401
from .dashboard import (  # noqa: F401
    CasePhaseHistorySerializer,
    PendingAttentionSerializer,
)
from .drafts import CaseDraftSerializer  # noqa: F401
from .invoices import (  # noqa: F401
    AdditionalInvoiceFeeSerializer,
    InvoiceGenerateRequestSerializer,
    InvoiceSerializer,
)
from .update import CaseUpdateSerializer  # noqa: F401

__all__ = [
    "AdditionalInvoiceFeeSerializer",
    "BotanicalAssessmentSerializer",
    "CaseCreateSerializer",
    "CaseDraftSerializer",
    "CaseListSerializer",
    "CasePhaseHistorySerializer",
    "CaseSerializer",
    "CaseUpdateSerializer",
    "CertificateSerializer",
    "DrugBagBatchCreateSerializer",
    "DrugBagBatchItemSerializer",
    "DrugBagCreateSerializer",
    "DrugBagSerializer",
    "InvoiceGenerateRequestSerializer",
    "InvoiceSerializer",
    "PendingAttentionSerializer",
    "PoliceOfficerTinySerializer",
    "UserTinySerializer",
]

# Backward-compatible aliases
SubmissionListSerializer = CaseListSerializer
SubmissionSerializer = CaseSerializer
SubmissionCreateSerializer = CaseCreateSerializer
SubmissionUpdateSerializer = CaseUpdateSerializer
SubmissionDraftSerializer = CaseDraftSerializer
SubmissionPhaseHistorySerializer = CasePhaseHistorySerializer
