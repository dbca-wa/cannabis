"""Targeted unit and integration tests for non-destructive certificate generation.

Covers:
- Non-destructive generation: generating cert B leaves cert A unchanged
- Rejection: form with no bags, form with unassessed bag
- Regeneration reuses the same number
- Rejection when the form's cert is batched
"""

from unittest.mock import patch

import pytest
from django.utils import timezone

from cases.models import (
    Batch,
    BotanicalAssessment,
    Case,
    Certificate,
    DrugBag,
    Priority3Form,
)
from cases.services.certificate_service import CertificateService
from common.models import SystemSettings

pytestmark = pytest.mark.django_db

PDF_PATCH = "cases.services.certificate_service.PDFService._html_to_pdf"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    """Write generated PDFs to a temp dir, not the real media root."""
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture
def sys_settings(db):
    """Ensure SystemSettings singleton exists."""
    return SystemSettings.load()


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(email="certgen@test.com", password="x")


def _make_case(num):
    return Case.objects.create(
        case_number=f"CERTGEN-{num}",
        received=timezone.now(),
    )


def _assessed_form(case, tag_prefix, n_bags=1):
    """Create a form with n assessed bags."""
    form = Priority3Form.objects.create(case=case)
    for i in range(n_bags):
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"{tag_prefix}-{i:03d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )
    return form


class TestNonDestructiveGeneration:
    """Generating a certificate for one form never touches another form's cert."""

    def test_existing_cert_unchanged_after_new_form_generated(self, sys_settings, user):
        case = _make_case("001")
        form_a = _assessed_form(case, "A")
        form_b = _assessed_form(case, "B", n_bags=3)

        with patch(PDF_PATCH, return_value=b"%PDF-A content"):
            cert_a = CertificateService.generate_certificate(form_a, user)

        # Record cert A's state before generating B
        a_pk = cert_a.pk
        a_number = cert_a.certificate_number
        a_pdf_size = cert_a.pdf_size

        with patch(PDF_PATCH, return_value=b"%PDF-B content"):
            cert_b = CertificateService.generate_certificate(form_b, user)

        # Cert A is entirely unchanged
        cert_a.refresh_from_db()
        assert cert_a.pk == a_pk
        assert cert_a.certificate_number == a_number
        assert cert_a.pdf_size == a_pdf_size

        # Cert B has its own distinct number
        assert cert_b.certificate_number != cert_a.certificate_number

        # Cert A's bags are still form_a's bags
        assert set(cert_a.form.bags.values_list("pk", flat=True)) == set(
            form_a.bags.values_list("pk", flat=True)
        )


class TestRejections:
    """Certificate generation refuses invalid forms."""

    def test_rejects_form_with_no_bags(self, sys_settings, user):
        case = _make_case("002")
        form = Priority3Form.objects.create(case=case)

        with pytest.raises(Exception) as exc_info:
            CertificateService.generate_certificate(form, user)
        assert "no drug bags" in str(exc_info.value).lower()

    def test_rejects_form_with_unassessed_bag(self, sys_settings, user):
        case = _make_case("003")
        form = Priority3Form.objects.create(case=case)
        DrugBag.objects.create(
            form=form,
            seal_tag_numbers="UNASSESSED-001",
            content_type="plant",
        )

        with pytest.raises(Exception) as exc_info:
            CertificateService.generate_certificate(form, user)
        assert "assessed" in str(exc_info.value).lower()

    def test_rejects_form_with_pending_assessment(self, sys_settings, user):
        case = _make_case("004")
        form = Priority3Form.objects.create(case=case)
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers="PENDING-001",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(drug_bag=bag, determination="pending")

        with pytest.raises(Exception) as exc_info:
            CertificateService.generate_certificate(form, user)
        assert "assessed" in str(exc_info.value).lower()


class TestRegeneration:
    """Regenerating a certificate reuses the same number and pk."""

    def test_regeneration_keeps_same_number(self, sys_settings, user):
        case = _make_case("005")
        form = _assessed_form(case, "REGEN")

        with patch(PDF_PATCH, return_value=b"%PDF-1.4 first"):
            cert = CertificateService.generate_certificate(form, user)
        first_pk = cert.pk
        first_number = cert.certificate_number

        form.refresh_from_db()
        with patch(PDF_PATCH, return_value=b"%PDF-1.4 second"):
            cert2 = CertificateService.generate_certificate(form, user)

        assert cert2.pk == first_pk
        assert cert2.certificate_number == first_number
        assert Certificate.objects.filter(form=form).count() == 1


class TestBatchedFrozen:
    """A certificate that is already batched cannot be regenerated."""

    def test_rejects_generation_when_batched(self, sys_settings, user):
        case = _make_case("006")
        form = _assessed_form(case, "FROZEN")

        with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
            cert = CertificateService.generate_certificate(form, user)

        # Simulate batching by attaching a batch
        batch = Batch.objects.create(
            certificate_count=1,
            bag_count=1,
        )
        cert.batch = batch
        cert.save(update_fields=["batch"])

        form.refresh_from_db()
        with pytest.raises(Exception) as exc_info:
            CertificateService.generate_certificate(form, user)
        assert "batched" in str(exc_info.value).lower()
