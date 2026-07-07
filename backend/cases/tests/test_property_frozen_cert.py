"""Property 7: Batched certificates are frozen — immutable number/bags/PDF.

**Validates: Requirements 4.5, 6.8**

Generates a certificate, batches it, then performs further operations (add new
forms, generate new certs, batch those). Asserts the original batched cert's
number, bags, and PDF are unchanged. Also asserts that regenerating a batched
certificate is rejected.
"""

from unittest.mock import patch

import pytest
from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st
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
        email="frozencert@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate(user, case=None):
    """Create a form with assessed bags, generate its certificate, advance to batching."""
    _counter["val"] += 1
    if case is None:
        case = Case.objects.create(
            case_number=f"FC-{_counter['val']:06d}",
            received=timezone.now(),
        )
    form = Priority3Form.objects.create(case=case)
    for i in range(2):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"FC-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

    with patch(PDF_PATCH, return_value=b"%PDF-1.4 frozen"):
        cert = CertificateService.generate_certificate(form, user)

    form.refresh_from_db()
    if form.phase == Case.PhaseChoices.UNSIGNED_GENERATION:
        WorkflowService.advance_form(form, user)
        form.refresh_from_db()

    assert form.phase == Case.PhaseChoices.BATCHING
    return cert


@settings(max_examples=10, deadline=None)
@given(
    extra_forms=st.integers(min_value=1, max_value=3),
)
def test_batched_cert_is_frozen(extra_forms):
    """A batched certificate's number, bag set, and PDF do not change even when
    further operations happen on the case."""
    SystemSettings.load()
    user = _make_user()

    # Create and batch the first certificate
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"FC-MAIN-{_counter['val']:06d}",
        received=timezone.now(),
    )
    original_cert = _make_eligible_certificate(user, case=case)

    # Record the original state
    original_number = original_cert.certificate_number
    original_bag_ids = set(original_cert.bags.values_list("pk", flat=True))
    original_pdf_size = original_cert.pdf_size

    # Batch the original cert
    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        BatchService.create_batch([original_cert.pk], user)

    # Perform later operations: add new forms, generate their certs, batch them
    new_certs = []
    for _ in range(extra_forms):
        new_cert = _make_eligible_certificate(user, case=case)
        new_certs.append(new_cert)

    if new_certs:
        new_cert_ids = [c.pk for c in new_certs]
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            BatchService.create_batch(new_cert_ids, user)

    # Assert the original certificate is unchanged
    original_cert.refresh_from_db()
    assert original_cert.certificate_number == original_number
    assert set(original_cert.bags.values_list("pk", flat=True)) == original_bag_ids
    assert original_cert.pdf_size == original_pdf_size


@settings(max_examples=10, deadline=None)
@given(data=st.data())
def test_regenerating_batched_cert_is_rejected(data):
    """Regenerating a certificate that is already in a batch raises
    a ValidationError."""
    SystemSettings.load()
    user = _make_user()

    cert = _make_eligible_certificate(user)

    # Batch it
    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        BatchService.create_batch([cert.pk], user)

    cert.refresh_from_db()
    assert cert.batch_id is not None

    # Attempting to regenerate should fail
    with pytest.raises(ValidationError):
        with patch(PDF_PATCH, return_value=b"%PDF-1.4 new"):
            CertificateService.regenerate_certificate_pdf(cert)
