from django.urls import path

from . import views

urlpatterns = [
    # Draft endpoint
    path("drafts", views.CaseDraftView.as_view(), name="case_draft"),
    # Case endpoints
    path("list", views.CaseListView.as_view(), name="case_list"),
    path(
        "check-number",
        views.CaseNumberCheckView.as_view(),
        name="case_number_check",
    ),
    path("<int:pk>", views.CaseDetailView.as_view(), name="case_detail"),
    path(
        "<int:pk>/phase-history",
        views.CasePhaseHistoryView.as_view(),
        name="case_phase_history",
    ),
    # Priority 3 form endpoints
    path(
        "<int:pk>/forms",
        views.CaseFormListCreateView.as_view(),
        name="case_forms",
    ),
    path(
        "forms/<int:pk>",
        views.FormDetailView.as_view(),
        name="form_detail",
    ),
    path(
        "forms/<int:pk>/workflow",
        views.FormWorkflowView.as_view(),
        name="form_workflow",
    ),
    path(
        "forms/<int:pk>/bags/batch",
        views.DrugBagBatchCreateView.as_view(),
        name="drugbag_batch_create",
    ),
    path(
        "forms/<int:pk>/certificate/generate",
        views.FormCertificateGenerateView.as_view(),
        name="form_certificate_generate",
    ),
    path(
        "forms/<int:pk>/scanned-image",
        views.FormScannedImageUploadView.as_view(),
        name="form_scanned_image",
    ),
    # Batch endpoints
    path("batches", views.BatchListCreateView.as_view(), name="batch_list_create"),
    path("batches/export", views.BatchExportView.as_view(), name="batch_export"),
    path("batches/<int:pk>", views.BatchDetailView.as_view(), name="batch_detail"),
    path(
        "batches/<int:pk>/invoice-raised",
        views.BatchInvoiceRaisedView.as_view(),
        name="batch_invoice_raised",
    ),
    path(
        "batches/<int:pk>/download",
        views.BatchDownloadView.as_view(),
        name="batch_download",
    ),
    path(
        "batches/<int:pk>/repackage",
        views.BatchRepackageView.as_view(),
        name="batch_repackage",
    ),
    # Drug bag endpoints
    path(
        "<int:pk>/bags",
        views.DrugBagListView.as_view(),
        name="drugbag_list",
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
