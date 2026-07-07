"""Cases services — business logic extracted from views."""

from .batch_service import BatchService
from .certificate_service import (
    CertificateService,
    build_certificate_context,
    generate_certificate,
    regenerate_certificate_pdf,
)
from .dashboard_service import DashboardService
from .draft_service import (
    delete_user_draft,
    get_user_draft,
    upsert_user_draft,
)
from .drug_bag_service import DrugBagService
from .ocr_service import OcrService, ServiceUnavailable
from .pdf_service import PDFService
from .pdf_test_service import TestPDFService
from .workflow_service import (
    WorkflowService,
    advance_form_phase,
    get_phase_order,
    get_phase_transitions,
    validate_transition,
)

__all__ = [
    # Service classes
    "BatchService",
    "CertificateService",
    "DashboardService",
    "DrugBagService",
    "OcrService",
    "PDFService",
    "ServiceUnavailable",
    "TestPDFService",
    "WorkflowService",
    # Workflow (module-level convenience functions)
    "advance_form_phase",
    "get_phase_transitions",
    "get_phase_order",
    "validate_transition",
    # Certificates (backward-compatible functions)
    "build_certificate_context",
    "generate_certificate",
    "regenerate_certificate_pdf",
    # Drafts
    "get_user_draft",
    "upsert_user_draft",
    "delete_user_draft",
]
