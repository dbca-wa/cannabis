"""Integration tests for batching behaviour over time.

**Validates: Requirements 6.7, 6.8, 6.9, 9.2, 9.3**

Covers:
- create_batch rejects an empty selection
- A case's certificates can land in different batches at different times
- Eligibility gating (only batching-phase + no batch)
- Recording invoice freezes the batch; unsetting returns to in_batch
"""

from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import BotanicalAssessment, Case, DrugBag, Priority3Form
from cases.services.batch_service import BatchService
from cases.services.certificate_service import CertificateService
from cases.services.workflow_service import WorkflowService
from common.models import SystemSettings

pytestmark = pytest.mark.django_db(transaction=True)

PDF_PATCH = "cases.services.certificate_service.PDFService._html_to_pdf"
BATCH_PDF_PATCH = "cases.services.batch_service.PDFService._html_to_pdf"
_counter = {"val": 0}


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email="batchtime@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate(user, case=None, n_bags=2):
    """Create a form with assessed bags, generate its certificate, advance to batching."""
    _counter["val"] += 1
    if case is None:
        case = Case.objects.create(
            case_number=f"BT-{_counter['val']:06d}",
            received=timezone.now(),
        )
    form = Priority3Form.objects.create(case=case)
    for _ in range(n_bags):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"BT-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        cert = CertificateService.generate_certificate(form, user)

    form.refresh_from_db()
    if form.phase == Case.PhaseChoices.UNSIGNED_GENERATION:
        WorkflowService.advance_form(form, user)
        form.refresh_from_db()

    assert form.phase == Case.PhaseChoices.BATCHING
    return cert


class TestBatchCreationValidation:
    """Validation rules on batch creation."""

    def test_rejects_empty_selection(self):
        """create_batch rejects an empty certificate list."""
        SystemSettings.load()
        user = _make_user()

        with pytest.raises(ValidationError) as exc_info:
            BatchService.create_batch([], user)

        assert "certificate_ids" in exc_info.value.detail

    def test_rejects_non_batching_phase_cert(self):
        """A certificate whose form is not in the batching phase is rejected."""
        SystemSettings.load()
        user = _make_user()

        _counter["val"] += 1
        case = Case.objects.create(
            case_number=f"BT-INELIG-{_counter['val']:06d}",
            received=timezone.now(),
        )
        form = Priority3Form.objects.create(case=case)
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"BT-INELIG-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

        # Generate cert (form advances to unsigned_generation) but do NOT advance
        # to batching — cert is not eligible
        with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
            cert = CertificateService.generate_certificate(form, user)

        form.refresh_from_db()
        assert form.phase != Case.PhaseChoices.BATCHING
        assert not cert.is_batch_eligible

        with pytest.raises(ValidationError):
            with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
                BatchService.create_batch([cert.pk], user)

    def test_rejects_already_batched_cert(self):
        """A certificate already in a batch cannot be batched again."""
        SystemSettings.load()
        user = _make_user()

        cert = _make_eligible_certificate(user)
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            BatchService.create_batch([cert.pk], user)

        cert.refresh_from_db()
        assert cert.batch_id is not None

        with pytest.raises(ValidationError):
            with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
                BatchService.create_batch([cert.pk], user)


class TestCaseCertsInDifferentBatches:
    """Certificates from the same case can land in different batches."""

    def test_case_certs_in_different_batches(self):
        """Two forms on the same case produce certificates that are batched
        separately at different times."""
        SystemSettings.load()
        user = _make_user()

        _counter["val"] += 1
        case = Case.objects.create(
            case_number=f"BT-MULTI-{_counter['val']:06d}",
            received=timezone.now(),
        )

        cert1 = _make_eligible_certificate(user, case=case)
        cert2 = _make_eligible_certificate(user, case=case)

        # Batch cert1 first
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch1 = BatchService.create_batch([cert1.pk], user)

        # Batch cert2 separately
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch2 = BatchService.create_batch([cert2.pk], user)

        cert1.refresh_from_db()
        cert2.refresh_from_db()
        assert cert1.batch_id == batch1.pk
        assert cert2.batch_id == batch2.pk
        assert batch1.pk != batch2.pk


class TestInvoiceRaisedFreezesAndUnsets:
    """Recording and unsetting an invoice-raised number transitions forms."""

    def test_record_invoice_completes_forms(self):
        """Recording an invoice-raised number advances all batch certs' forms
        to complete."""
        SystemSettings.load()
        user = _make_user()

        cert = _make_eligible_certificate(user)
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch = BatchService.create_batch([cert.pk], user)

        # Record invoice
        BatchService.record_invoice_raised(batch, "INV-TIME-001", user)

        cert.refresh_from_db()
        assert cert.form.phase == Case.PhaseChoices.COMPLETE
        assert cert.form.completed_at is not None

    def test_unset_invoice_returns_to_in_batch(self):
        """Unsetting the invoice-raised number returns forms to in_batch."""
        SystemSettings.load()
        user = _make_user()

        cert = _make_eligible_certificate(user)
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch = BatchService.create_batch([cert.pk], user)

        BatchService.record_invoice_raised(batch, "INV-TIME-002", user)
        cert.refresh_from_db()
        assert cert.form.phase == Case.PhaseChoices.COMPLETE

        # Unset
        BatchService.unset_invoice_raised(batch, user)
        cert.refresh_from_db()
        assert cert.form.phase == Case.PhaseChoices.IN_BATCH
        assert cert.form.completed_at is None

    def test_duplicate_invoice_number_rejected(self):
        """A duplicate invoice-raised number is rejected."""
        SystemSettings.load()
        user = _make_user()

        cert1 = _make_eligible_certificate(user)
        cert2 = _make_eligible_certificate(user)

        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch1 = BatchService.create_batch([cert1.pk], user)
            batch2 = BatchService.create_batch([cert2.pk], user)

        BatchService.record_invoice_raised(batch1, "INV-DUP-001", user)

        with pytest.raises(ValidationError):
            BatchService.record_invoice_raised(batch2, "INV-DUP-001", user)


class TestDeleteBatchReturnsToBatching:
    """Deleting a batch frees certificates and returns forms to batching."""

    def test_delete_batch_frees_certs(self):
        """After deletion, certs have no batch and forms return to batching."""
        SystemSettings.load()
        user = _make_user()

        cert = _make_eligible_certificate(user)
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            batch = BatchService.create_batch([cert.pk], user)

        cert.refresh_from_db()
        assert cert.batch_id is not None
        assert cert.form.phase == Case.PhaseChoices.IN_BATCH

        BatchService.delete_batch(batch, user)

        cert.refresh_from_db()
        assert cert.batch_id is None
        assert cert.form.phase == Case.PhaseChoices.BATCHING
