"""Property 8: batch.certificate_count == batch.certificates.count() == k.

**Validates: Requirements 7.5**

Creates a batch from k eligible certificates (k=1..12) and asserts both the
stored denormalised count and the actual queryset count equal k.
"""

from unittest.mock import patch

import pytest
from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st

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
        email="certcount@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate(user):
    """Create a form with assessed bags, generate its certificate, advance to batching."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"CC-{_counter['val']:06d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    _counter["val"] += 1
    bag = DrugBag.objects.create(
        form=form,
        seal_tag_numbers=f"CC-TAG-{_counter['val']:06d}",
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


@settings(max_examples=10, deadline=None)
@given(
    k=st.integers(min_value=1, max_value=12),
)
def test_batch_certificate_count_equals_k(k):
    """batch.certificate_count and batch.certificates.count() both equal k."""
    SystemSettings.load()
    user = _make_user()

    certs = [_make_eligible_certificate(user) for _ in range(k)]
    cert_ids = [c.pk for c in certs]

    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        batch = BatchService.create_batch(cert_ids, user)

    batch.refresh_from_db()
    assert batch.certificate_count == k
    assert batch.certificates.count() == k
