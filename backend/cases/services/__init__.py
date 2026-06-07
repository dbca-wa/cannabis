"""Cases services — business logic extracted from views."""

from .certificate_service import (
    CertificateService,
    build_certificate_context,
    generate_unsigned_certificate,
    regenerate_certificate_pdf,
    validate_certificate_generation,
)
from .dashboard_service import DashboardService
from .draft_service import (
    delete_user_draft,
    get_user_draft,
    upsert_user_draft,
)
from .drug_bag_service import DrugBagService
from .invoice_service import (
    InvoiceService,
    build_invoice_context,
    generate_invoice,
    regenerate_invoice_pdf,
)
from .ocr_service import OcrService, ServiceUnavailable
from .pdf_service import PDFService
from .pdf_test_service import TestPDFService
from .workflow_service import (
    WorkflowService,
    advance_submission_phase,
    get_phase_order,
    get_phase_transitions,
    send_back_submission,
    validate_send_back,
    validate_transition,
)

__all__ = [
    # Service classes
    "CertificateService",
    "DashboardService",
    "DrugBagService",
    "InvoiceService",
    "OcrService",
    "PDFService",
    "ServiceUnavailable",
    "TestPDFService",
    "WorkflowService",
    # Workflow (backward-compatible functions)
    "advance_submission_phase",
    "get_phase_transitions",
    "get_phase_order",
    "validate_transition",
    "validate_send_back",
    "send_back_submission",
    # Certificates (backward-compatible functions)
    "build_certificate_context",
    "generate_unsigned_certificate",
    "regenerate_certificate_pdf",
    "validate_certificate_generation",
    # Invoices (backward-compatible functions)
    "build_invoice_context",
    "generate_invoice",
    "regenerate_invoice_pdf",
    # Drafts
    "get_user_draft",
    "upsert_user_draft",
    "delete_user_draft",
]
