from django.urls import path
from . import views


urlpatterns = [
    # Submission endpoints
    path("", views.SubmissionListView.as_view(), name="submission_list"),
    path("<int:pk>/", views.SubmissionDetailView.as_view(), name="submission_detail"),
    path(
        "<int:submission_id>/workflow/",
        views.SubmissionWorkflowView.as_view(),
        name="submission_workflow",
    ),
    path(
        "<int:submission_id>/send-back/",
        views.SubmissionSendBackView.as_view(),
        name="submission_send_back",
    ),
    path(
        "<int:submission_id>/phase-history/",
        views.SubmissionPhaseHistoryView.as_view(),
        name="submission_phase_history",
    ),
    # Drug bag endpoints
    path(
        "<int:submission_id>/bags/",
        views.DrugBagListView.as_view(),
        name="drugbag_list",
    ),
    path("bags/<int:pk>/", views.DrugBagDetailView.as_view(), name="drugbag_detail"),
    # Botanical assessment endpoints
    path(
        "bags/<int:drug_bag_id>/assessment/",
        views.BotanicalAssessmentCreateView.as_view(),
        name="assessment_create",
    ),
    path(
        "assessments/<int:pk>/",
        views.BotanicalAssessmentDetailView.as_view(),
        name="assessment_detail",
    ),
    # Certificate endpoints
    path(
        "<int:submission_id>/certificates/",
        views.CertificateListView.as_view(),
        name="certificate_list",
    ),
    path(
        "certificates/<int:pk>/",
        views.CertificateDetailView.as_view(),
        name="certificate_detail",
    ),
    path(
        "certificates/test/generate",
        views.GenerateTestCertificateView.as_view(),
        name="test_certificate",
    ),
    # Invoice endpoints
    path(
        "<int:submission_id>/invoices/",
        views.InvoiceListView.as_view(),
        name="invoice_list",
    ),
    path(
        "invoices/<int:pk>/",
        views.InvoiceDetailView.as_view(),
        name="invoice_detail",
    ),
    # Additional fees endpoints
    path(
        "<int:submission_id>/fees/",
        views.AdditionalInvoiceFeeListView.as_view(),
        name="additional_fee_list",
    ),
]
