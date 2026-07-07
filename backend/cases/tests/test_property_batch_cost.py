"""Property 10: Batch cost is computed from snapshotted rates and is immune to
later rate changes.

**Validates: Requirements 6.4, 7.1, 7.2, 7.3**

Sets randomised rates, creates a batch, then changes the global rates. Asserts
the batch's stored totals match the snapshot formula and that later rate changes
do not affect the batch.
"""

from decimal import ROUND_HALF_UP, Decimal
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


def _money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email="batchcost@test.com",
        defaults={"password": "x", "role": "finance"},
    )
    return user


def _make_eligible_certificate_with_bags(user, n_bags):
    """Create a form with n_bags assessed bags, generate its certificate, advance to batching."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"COST-{_counter['val']:06d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    for _ in range(n_bags):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"COST-TAG-{_counter['val']:06d}",
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
@given(data=st.data())
def test_batch_cost_uses_snapshotted_rates(data):
    """Batch costs match the snapshotted rates at creation time and are immune
    to subsequent global rate changes."""
    # Draw rates
    cert_rate_cents = data.draw(st.integers(min_value=100, max_value=50000))
    bag_rate_cents = data.draw(st.integers(min_value=100, max_value=50000))
    tax_pct_cents = data.draw(st.integers(min_value=0, max_value=2500))
    n_certs = data.draw(st.integers(min_value=1, max_value=3))
    bag_counts = data.draw(
        st.lists(
            st.integers(min_value=1, max_value=5),
            min_size=n_certs,
            max_size=n_certs,
        )
    )

    cert_rate = Decimal(str(cert_rate_cents)) / Decimal("100")
    bag_rate = Decimal(str(bag_rate_cents)) / Decimal("100")
    tax_pct = Decimal(str(tax_pct_cents)) / Decimal("100")

    ss = SystemSettings.load()
    ss.refresh_from_db()
    ss.cost_per_certificate = cert_rate
    ss.cost_per_bag = bag_rate
    ss.tax_percentage = tax_pct
    ss.save(update_fields=["cost_per_certificate", "cost_per_bag", "tax_percentage"])

    user = _make_user()

    certs = [_make_eligible_certificate_with_bags(user, n) for n in bag_counts]
    cert_ids = [c.pk for c in certs]

    with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
        batch = BatchService.create_batch(cert_ids, user)

    # Compute expected totals from the snapshotted rates
    certificate_count = len(certs)
    bag_count = sum(bag_counts)
    expected_cert_cost = _money(certificate_count * cert_rate)
    expected_bag_cost = _money(bag_count * bag_rate)
    expected_subtotal = _money(expected_cert_cost + expected_bag_cost)
    expected_tax = _money(expected_subtotal * tax_pct / Decimal("100"))
    expected_total = _money(expected_subtotal + expected_tax)

    batch.refresh_from_db()
    assert batch.cert_rate == cert_rate
    assert batch.bag_rate == bag_rate
    assert batch.tax_percentage == tax_pct
    assert batch.cert_cost == expected_cert_cost
    assert batch.bag_cost == expected_bag_cost
    assert batch.subtotal == expected_subtotal
    assert batch.tax_amount == expected_tax
    assert batch.total == expected_total

    # Now change the global rates to something different
    new_cert_rate_cents = data.draw(st.integers(min_value=100, max_value=50000))
    new_bag_rate_cents = data.draw(st.integers(min_value=100, max_value=50000))
    new_tax_pct_cents = data.draw(st.integers(min_value=0, max_value=2500))
    new_cert_rate = Decimal(str(new_cert_rate_cents)) / Decimal("100")
    new_bag_rate = Decimal(str(new_bag_rate_cents)) / Decimal("100")
    new_tax_pct = Decimal(str(new_tax_pct_cents)) / Decimal("100")

    ss.refresh_from_db()
    ss.cost_per_certificate = new_cert_rate
    ss.cost_per_bag = new_bag_rate
    ss.tax_percentage = new_tax_pct
    ss.save(update_fields=["cost_per_certificate", "cost_per_bag", "tax_percentage"])

    # Batch's stored values remain unchanged
    batch.refresh_from_db()
    assert batch.cert_rate == cert_rate
    assert batch.bag_rate == bag_rate
    assert batch.tax_percentage == tax_pct
    assert batch.cert_cost == expected_cert_cost
    assert batch.bag_cost == expected_bag_cost
    assert batch.subtotal == expected_subtotal
    assert batch.tax_amount == expected_tax
    assert batch.total == expected_total
