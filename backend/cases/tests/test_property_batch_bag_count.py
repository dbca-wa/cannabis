"""Property 9: batch.bag_count == sum of bags across its certificates' forms.

**Validates: Requirements 7.5**

Creates a batch from eligible certificates with varying bag counts and asserts
the stored bag_count equals the sum of each certificate's form's bag count.
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
        email="bagcount@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate_with_bags(user, n_bags):
    """Create a form with n_bags assessed bags, generate its certificate, advance to batching."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"BC-{_counter['val']:06d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    for _ in range(n_bags):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"BC-TAG-{_counter['val']:06d}",
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
    bag_counts=st.lists(
        st.integers(min_value=1, max_value=5),
        min_size=1,
        max_size=6,
    )
)
def test_batch_bag_count_equals_sum_of_form_bags(bag_counts):
    """batch.bag_count equals the sum of bags across all certificates' forms."""
    SystemSettings.load()
    user = _make_user()

    certs = [_make_eligible_certificate_with_bags(user, n) for n in bag_counts]
    cert_ids = [c.pk for c in certs]

    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        batch = BatchService.create_batch(cert_ids, user)

    batch.refresh_from_db()
    expected_bags = sum(bag_counts)
    assert batch.bag_count == expected_bags

    # Also verify against the actual DB query
    actual_bags = sum(
        c.form.bags.count() for c in batch.certificates.select_related("form").all()
    )
    assert batch.bag_count == actual_bags
