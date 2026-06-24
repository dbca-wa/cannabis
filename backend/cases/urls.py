from django.urls import path

from . import views

urlpatterns = [
    # Draft endpoint
    path("drafts", views.CaseDraftView.as_view(), name="case_draft"),
    # Case endpoints
    path("list", views.CaseListView.as_view(), name="case_list"),
    path("<int:pk>", views.CaseDetailView.as_view(), name="case_detail"),
    path(
        "<int:pk>/workflow",
        views.CaseWorkflowView.as_view(),
        name="case_workflow",
    ),
    path(
        "<int:pk>/send-back",
        views.CaseSendBackView.as_view(),
        name="case_send_back",
    ),
    path(
        "<int:pk>/send-documents",
        views.SendDocumentsView.as_view(),
        name="send_documents",
    ),
    path(
        "<int:pk>/phase-history",
        views.CasePhaseHistoryView.as_view(),
        name="case_phase_history",
    ),
    # Drug bag endpoints
    path(
        "<int:pk>/bags",
        views.DrugBagListView.as_view(),
        name="drugbag_list",
    ),
    path(
        "<int:pk>/bags/batch",
        views.DrugBagBatchCreateView.as_view(),
        name="drugbag_batch_create",
    ),
    path("bags/<int:pk>", views.DrugBagDetailView.as_view(), name="drugbag_detail"),
    # Botanical assessment endpoints
    path(
        "bags/<int:drug_bag_id>/assessment",
        views.BotanicalAssessmentCreateView.as_view(),
        name="assessment_create",
    ),
    path(
        "assessments/<int:pk>",
        views.BotanicalAssessmentDetailView.as_view(),
        name="assessment_detail",
    ),
    # Certificate endpoints (flat list — all certificates across cases)
    path(
        "certificates",
        views.AllCertificatesListView.as_view(),
        name="all_certificates_list",
    ),
    # Certificate endpoints (scoped to a case)
    path(
        "<int:pk>/certificates",
        views.CertificateListView.as_view(),
        name="certificate_list",
    ),
    path(
        "<int:pk>/certificates/generate",
        views.CertificateGenerateView.as_view(),
        name="certificate_generate",
    ),
    path(
        "<int:pk>/certificates/<int:certificate_id>/pdf",
        views.CertificatePdfView.as_view(),
        name="certificate_pdf",
    ),
    path(
        "<int:pk>/certificates/<int:certificate_id>/regenerate",
        views.CertificateRegenerateView.as_view(),
        name="certificate_regenerate",
    ),
    path(
        "certificates/<int:pk>",
        views.CertificateDetailView.as_view(),
        name="certificate_detail",
    ),
    path(
        "certificates/<int:pk>/download",
        views.CertificateDownloadView.as_view(),
        name="certificate_download",
    ),
    path(
        "certificates/test/generate",
        views.GenerateTestCertificateView.as_view(),
        name="test_certificate",
    ),
    path(
        "invoices/test/generate",
        views.GenerateTestInvoiceView.as_view(),
        name="test_invoice",
    ),
    path(
        "<int:pk>/certificates/<int:certificate_id>/sign",
        views.SignCertificateView.as_view(),
        name="sign_certificate",
    ),
    path(
        "<int:pk>/certificates/<int:certificate_id>/unlock",
        views.UnlockCertificateView.as_view(),
        name="unlock_certificate",
    ),
    # Invoice endpoints (flat list — all invoices across cases)
    path(
        "invoices",
        views.AllInvoicesListView.as_view(),
        name="all_invoices_list",
    ),
    # Invoice endpoints (scoped to a case)
    path(
        "<int:pk>/invoices",
        views.InvoiceListView.as_view(),
        name="invoice_list",
    ),
    path(
        "<int:pk>/invoices/generate",
        views.InvoiceGenerateView.as_view(),
        name="invoice_generate",
    ),
    path(
        "<int:pk>/invoices/<int:invoice_id>/pdf",
        views.InvoicePdfView.as_view(),
        name="invoice_pdf",
    ),
    path(
        "<int:pk>/invoices/<int:invoice_id>/regenerate",
        views.InvoiceRegenerateView.as_view(),
        name="invoice_regenerate",
    ),
    path(
        "invoices/<int:pk>",
        views.InvoiceDetailView.as_view(),
        name="invoice_detail",
    ),
    path(
        "invoices/<int:pk>/download",
        views.InvoiceDownloadView.as_view(),
        name="invoice_download",
    ),
    # Additional fees endpoints
    path(
        "<int:pk>/fees",
        views.AdditionalInvoiceFeeListView.as_view(),
        name="additional_fee_list",
    ),
    # Dashboard endpoints
    path(
        "my",
        views.MyCasesView.as_view(),
        name="my_cases",
    ),
    path(
        "pending-attention",
        views.PendingAttentionView.as_view(),
        name="pending_attention",
    ),
    path(
        "stats/certificates",
        views.CertificateStatsView.as_view(),
        name="certificate_stats",
    ),
    path(
        "stats/revenue",
        views.RevenueStatsView.as_view(),
        name="revenue_stats",
    ),
    path(
        "stats/throughput",
        views.MonthlyThroughputView.as_view(),
        name="monthly_throughput",
    ),
    path(
        "stats/phase-counts",
        views.PhaseCountsView.as_view(),
        name="phase_counts",
    ),
    # OCR upload endpoint
    path(
        "ocr-upload",
        views.OcrUploadView.as_view(),
        name="ocr_upload",
    ),
]
