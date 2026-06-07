"""Cases views package.

Re-exports all view classes so that existing imports like
``from . import views`` followed by ``views.CaseListView`` continue to work.
"""

from .bags import (  # noqa: F401
    BotanicalAssessmentCreateView,
    BotanicalAssessmentDetailView,
    DrugBagDetailView,
    DrugBagListView,
)
from .certificates import (  # noqa: F401
    AllCertificatesListView,
    CertificateDetailView,
    CertificateDownloadView,
    CertificateGenerateView,
    CertificateListView,
    CertificatePdfView,
    CertificateRegenerateView,
    GenerateTestCertificateView,
    SignCertificateView,
    UnlockCertificateView,
)
from .crud import CaseDetailView, CaseListView  # noqa: F401
from .dashboard import (  # noqa: F401
    CertificateStatsView,
    MyCasesView,
    PendingAttentionView,
    PhaseCountsView,
    RevenueStatsView,
)
from .drafts import CaseDraftView  # noqa: F401
from .invoices import (  # noqa: F401
    AdditionalInvoiceFeeListView,
    AllInvoicesListView,
    GenerateTestInvoiceView,
    InvoiceDetailView,
    InvoiceDownloadView,
    InvoiceGenerateView,
    InvoiceListView,
    InvoicePdfView,
    InvoiceRegenerateView,
)
from .ocr import OcrUploadView, ServiceUnavailable  # noqa: F401
from .previews import CertificatePreviewView, InvoicePreviewView  # noqa: F401
from .workflow import (  # noqa: F401
    CasePhaseHistoryView,
    CaseSendBackView,
    CaseWorkflowView,
)

__all__ = [
    # bags
    "BotanicalAssessmentCreateView",
    "BotanicalAssessmentDetailView",
    "DrugBagDetailView",
    "DrugBagListView",
    # certificates
    "AllCertificatesListView",
    "CertificateDetailView",
    "CertificateDownloadView",
    "CertificateGenerateView",
    "CertificateListView",
    "CertificatePdfView",
    "CertificateRegenerateView",
    "GenerateTestCertificateView",
    "SignCertificateView",
    "UnlockCertificateView",
    # crud
    "CaseDetailView",
    "CaseListView",
    # dashboard
    "CertificateStatsView",
    "MyCasesView",
    "PendingAttentionView",
    "PhaseCountsView",
    "RevenueStatsView",
    # drafts
    "CaseDraftView",
    # invoices
    "AdditionalInvoiceFeeListView",
    "AllInvoicesListView",
    "GenerateTestInvoiceView",
    "InvoiceDetailView",
    "InvoiceDownloadView",
    "InvoiceGenerateView",
    "InvoiceListView",
    "InvoicePdfView",
    "InvoiceRegenerateView",
    # ocr
    "OcrUploadView",
    "ServiceUnavailable",
    # previews
    "CertificatePreviewView",
    "InvoicePreviewView",
    # workflow
    "CasePhaseHistoryView",
    "CaseSendBackView",
    "CaseWorkflowView",
]
