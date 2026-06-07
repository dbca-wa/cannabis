"""Structural smoke tests.

Verifies that Django loads cleanly and all app packages resolve correctly.
"""

import pytest
from django.core.management import call_command

# ---------------------------------------------------------------------------
# Django system check
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_django_check_passes():
    """Verify Django system check reports 0 issues."""
    call_command("check", verbosity=0)


# ---------------------------------------------------------------------------
# cases app imports
# ---------------------------------------------------------------------------


def test_cases_services_importable():
    from cases.services import (
        CertificateService,
        DashboardService,
        DrugBagService,
        InvoiceService,
        OcrService,
        PDFService,
        TestPDFService,
        WorkflowService,
    )

    assert all(
        [
            CertificateService,
            DashboardService,
            DrugBagService,
            InvoiceService,
            OcrService,
            PDFService,
            TestPDFService,
            WorkflowService,
        ]
    )


def test_cases_views_importable():
    from cases.views import (
        CaseDetailView,
        CaseListView,
        CaseWorkflowView,
        CertificateListView,
        DrugBagListView,
        InvoiceListView,
        SignCertificateView,
    )

    assert all(
        [
            CaseDetailView,
            CaseListView,
            CaseWorkflowView,
            CertificateListView,
            DrugBagListView,
            InvoiceListView,
            SignCertificateView,
        ]
    )


def test_cases_serializers_importable():
    from cases.serializers import (
        CaseCreateSerializer,
        CaseListSerializer,
        CaseSerializer,
        CaseUpdateSerializer,
        CertificateSerializer,
        DrugBagSerializer,
        InvoiceSerializer,
    )

    assert all(
        [
            CaseCreateSerializer,
            CaseListSerializer,
            CaseSerializer,
            CaseUpdateSerializer,
            CertificateSerializer,
            DrugBagSerializer,
            InvoiceSerializer,
        ]
    )


def test_cases_permissions_importable():
    from cases.permissions import (
        IsApprovedBotanist,
        IsBotanistOrStaff,
        IsFinanceOfficer,
        IsStaffOrAdmin,
    )

    assert all(
        [
            IsApprovedBotanist,
            IsBotanistOrStaff,
            IsFinanceOfficer,
            IsStaffOrAdmin,
        ]
    )


# ---------------------------------------------------------------------------
# communications app imports
# ---------------------------------------------------------------------------


def test_communications_services_importable():
    from communications.services import EmailSendError, EmailService

    assert all([EmailService, EmailSendError])


def test_communications_views_importable():
    from communications.views import (
        NotificationDetailView,
        NotificationListView,
        SendTestEmailView,
        SubmissionCommentDetailView,
        SubmissionCommentListView,
    )

    assert all(
        [
            SubmissionCommentListView,
            SubmissionCommentDetailView,
            NotificationListView,
            NotificationDetailView,
            SendTestEmailView,
        ]
    )


def test_communications_serializers_importable():
    from communications.serializers import (
        NotificationSerializer,
        SubmissionCommentCreateSerializer,
        SubmissionCommentSerializer,
    )

    assert all(
        [
            SubmissionCommentSerializer,
            SubmissionCommentCreateSerializer,
            NotificationSerializer,
        ]
    )


def test_communications_permissions_importable():
    from communications.permissions import __all__ as permissions_all

    assert isinstance(permissions_all, list)


# ---------------------------------------------------------------------------
# common app imports
# ---------------------------------------------------------------------------


def test_common_services_importable():
    from common.services import SecurityService, SettingsService

    assert all([SecurityService, SettingsService])


def test_common_views_importable():
    from common.views import (
        ResetRateLimitsView,
        SecurityMonitoringView,
        SystemSettingsView,
    )

    assert all([SystemSettingsView, SecurityMonitoringView, ResetRateLimitsView])


def test_common_serializers_importable():
    from common.serializers import __all__ as serializers_all

    assert isinstance(serializers_all, list)


def test_common_permissions_importable():
    from common.permissions import __all__ as permissions_all

    assert isinstance(permissions_all, list)


# ---------------------------------------------------------------------------
# police app imports
# ---------------------------------------------------------------------------


def test_police_services_importable():
    from police.services import OfficerService, StationService

    assert all([OfficerService, StationService])


def test_police_views_importable():
    from police.views import (
        PoliceOfficerDetailView,
        PoliceOfficerListView,
        PoliceStationDetailView,
        PoliceStationListView,
    )

    assert all(
        [
            PoliceOfficerListView,
            PoliceOfficerDetailView,
            PoliceStationListView,
            PoliceStationDetailView,
        ]
    )


def test_police_serializers_importable():
    from police.serializers import (
        PoliceOfficerSerializer,
        PoliceOfficerTinySerializer,
        PoliceStationSerializer,
        PoliceStationTinySerializer,
    )

    assert all(
        [
            PoliceOfficerSerializer,
            PoliceOfficerTinySerializer,
            PoliceStationSerializer,
            PoliceStationTinySerializer,
        ]
    )


def test_police_permissions_importable():
    from police.permissions import __all__ as permissions_all

    assert isinstance(permissions_all, list)


# ---------------------------------------------------------------------------
# users app imports
# ---------------------------------------------------------------------------


def test_users_services_importable():
    from users.services import AuthService, PasswordResetCodeService, PasswordValidator

    assert all([AuthService, PasswordResetCodeService, PasswordValidator])


def test_users_views_importable():
    from users.views import (
        CustomTokenObtainPairView,
        JWTLogoutView,
        UserDetailView,
        UserListView,
        WhoAmI,
    )

    assert all(
        [
            CustomTokenObtainPairView,
            JWTLogoutView,
            UserDetailView,
            UserListView,
            WhoAmI,
        ]
    )


def test_users_serializers_importable():
    from users.serializers import (
        UserBasicSerializer,
        UserCreateSerializer,
        UserTinySerializer,
    )

    assert all([UserBasicSerializer, UserCreateSerializer, UserTinySerializer])


def test_users_permissions_importable():
    from users.permissions import IsAdminUser, IsStaffOrSuperuser

    assert all([IsAdminUser, IsStaffOrSuperuser])


# ---------------------------------------------------------------------------
# defendants app imports
# ---------------------------------------------------------------------------


def test_defendants_services_importable():
    from defendants.services import DefendantService

    assert DefendantService


def test_defendants_views_importable():
    from defendants.views import (
        DefendantExportView,
        DefendantListCreateView,
        DefendantMergeView,
        DefendantRetrieveUpdateDestroyView,
    )

    assert all(
        [
            DefendantListCreateView,
            DefendantRetrieveUpdateDestroyView,
            DefendantExportView,
            DefendantMergeView,
        ]
    )


def test_defendants_serializers_importable():
    from defendants.serializers import DefendantSerializer, DefendantTinySerializer

    assert all([DefendantSerializer, DefendantTinySerializer])


def test_defendants_permissions_importable():
    from defendants.permissions import __all__ as permissions_all

    assert isinstance(permissions_all, list)


# ---------------------------------------------------------------------------
# signatures app imports
# ---------------------------------------------------------------------------


def test_signatures_services_importable():
    from signatures.services import SignatureService

    assert SignatureService


def test_signatures_views_importable():
    from signatures.views import (
        MyAuditLogView,
        MySignatureImageView,
        MySignatureView,
        UserAuditLogView,
        UserSignatureImageView,
        UserSignatureView,
    )

    assert all(
        [
            MySignatureView,
            MySignatureImageView,
            UserSignatureView,
            UserSignatureImageView,
            MyAuditLogView,
            UserAuditLogView,
        ]
    )


def test_signatures_serializers_importable():
    from signatures.serializers import SignatureAuditLogSerializer, SignatureSerializer

    assert all([SignatureAuditLogSerializer, SignatureSerializer])


def test_signatures_permissions_importable():
    from signatures.permissions import __all__ as permissions_all

    assert isinstance(permissions_all, list)
