"""Property 6: Each certificate belongs to at most one batch.

**Validates: Requirements 6.8**

Creates eligible certificates, batches them in disjoint subsets, and asserts
each certificate is in at most one batch and that create_batch rejects an
already-batched certificate.
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
    _counter["val"] += 1
    user, _ = User.objects.get_or_create(
        email="singlebatch@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate(user):
    """Create a form with assessed bags, generate the certificate, then advance
    to batching so it becomes batch-eligible."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"SB-{_counter['val']:06d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    # Add 1-3 bags with assessments
    for i in range(2):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"SB-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

    # Generate certificate (advances form to unsigned_generation → batching)
    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        cert = CertificateService.generate_certificate(form, user)

    # Form is now at unsigned_generation; advance to batching
    form.refresh_from_db()
    if form.phase == Case.PhaseChoices.UNSIGNED_GENERATION:
        WorkflowService.advance_form(form, user)
        form.refresh_from_db()

    assert form.phase == Case.PhaseChoices.BATCHING
    assert cert.is_batch_eligible
    return cert


@settings(max_examples=10, deadline=None)
@given(
    partition_sizes=st.lists(
        st.integers(min_value=1, max_value=3),
        min_size=2,
        max_size=4,
    )
)
def test_certificate_in_at_most_one_batch(partition_sizes):
    """Certificates batched in disjoint subsets each belong to exactly one batch."""
    SystemSettings.load()
    user = _make_user()

    # Create all the certificates needed
    total_certs = sum(partition_sizes)
    certs = []
    for _ in range(total_certs):
        certs.append(_make_eligible_certificate(user))

    # Partition into disjoint subsets and batch each subset
    batches = []
    idx = 0
    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        for size in partition_sizes:
            subset = certs[idx : idx + size]
            idx += size
            cert_ids = [c.pk for c in subset]
            batch = BatchService.create_batch(cert_ids, user)
            batches.append(batch)

    # Assert: each certificate belongs to exactly one batch
    for cert in certs:
        cert.refresh_from_db()
        assert cert.batch_id is not None
        matching_batches = [b for b in batches if cert.batch_id == b.pk]
        assert len(matching_batches) == 1


@settings(max_examples=10, deadline=None)
@given(data=st.data())
def test_create_batch_rejects_already_batched_cert(data):
    """Attempting to batch a certificate that is already in a batch raises
    a ValidationError."""
    SystemSettings.load()
    user = _make_user()

    cert = _make_eligible_certificate(user)

    # Batch it once
    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        BatchService.create_batch([cert.pk], user)

    cert.refresh_from_db()
    assert cert.batch_id is not None

    # Attempt to batch again — should be rejected
    with pytest.raises(ValidationError):
        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            BatchService.create_batch([cert.pk], user)
