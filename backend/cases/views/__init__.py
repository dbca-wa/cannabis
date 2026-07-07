"""Cases views package.

Re-exports all view classes so that existing imports like
``from . import views`` followed by ``views.CaseListView`` continue to work.
"""

from .bags import (  # noqa: F401
    BotanicalAssessmentCreateView,
    BotanicalAssessmentDetailView,
    DrugBagBatchCreateView,
    DrugBagDetailView,
    DrugBagListView,
)
from .batches import (  # noqa: F401
    BatchDetailView,
    BatchDownloadView,
    BatchExportView,
    BatchInvoiceRaisedView,
    BatchListCreateView,
)
from .certificates import (  # noqa: F401
    AllCertificatesListView,
    CertificateDetailView,
    CertificateDownloadView,
    CertificateListView,
    CertificatePdfView,
    CertificateRegenerateView,
    GenerateTestCertificateView,
)
from .crud import CaseDetailView, CaseListView, CaseNumberCheckView  # noqa: F401
from .dashboard import (  # noqa: F401
    CertificateStatsView,
    MonthlyThroughputView,
    MyCasesView,
    PendingAttentionView,
    PhaseCountsView,
    RevenueStatsView,
)
from .drafts import CaseDraftView  # noqa: F401
from .forms import (  # noqa: F401
    CaseFormListCreateView,
    FormCertificateGenerateView,
    FormDetailView,
    FormScannedImageUploadView,
)
from .ocr import OcrUploadView, ServiceUnavailable  # noqa: F401
from .previews import CertificatePreviewView  # noqa: F401
from .workflow import (  # noqa: F401
    CasePhaseHistoryView,
    FormWorkflowView,
)

__all__ = [
    # bags
    "BotanicalAssessmentCreateView",
    "BotanicalAssessmentDetailView",
    "DrugBagBatchCreateView",
    "DrugBagDetailView",
    "DrugBagListView",
    # batches
    "BatchListCreateView",
    "BatchDetailView",
    "BatchDownloadView",
    "BatchInvoiceRaisedView",
    "BatchExportView",
    # certificates
    "AllCertificatesListView",
    "CertificateDetailView",
    "CertificateDownloadView",
    "CertificateListView",
    "CertificatePdfView",
    "CertificateRegenerateView",
    "GenerateTestCertificateView",
    # crud
    "CaseDetailView",
    "CaseListView",
    "CaseNumberCheckView",
    # forms
    "CaseFormListCreateView",
    "FormCertificateGenerateView",
    "FormDetailView",
    "FormScannedImageUploadView",
    # dashboard
    "CertificateStatsView",
    "MyCasesView",
    "PendingAttentionView",
    "PhaseCountsView",
    "RevenueStatsView",
    "MonthlyThroughputView",
    # drafts
    "CaseDraftView",
    # ocr
    "OcrUploadView",
    "ServiceUnavailable",
    # previews
    "CertificatePreviewView",
    # workflow
    "CasePhaseHistoryView",
    "FormWorkflowView",
]
