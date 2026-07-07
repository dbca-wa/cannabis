"""Property 4: Each bag is covered by exactly its form's one certificate (R10.4).

**Validates: Requirements 10.4**

Generates a form with bags, generates its certificate. Asserts
certificate.form.bags == form.bags exactly (no bag in two certificates).
"""

from unittest.mock import patch

import pytest
from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st

from cases.models import BotanicalAssessment, Case, Certificate, DrugBag, Priority3Form
from cases.services.certificate_service import CertificateService
from common.models import SystemSettings

pytestmark = pytest.mark.django_db(transaction=True)

PDF_PATCH = "cases.services.certificate_service.PDFService._html_to_pdf"
_counter = {"val": 0}


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email="certbag@test.com",
        defaults={"password": "x"},
    )
    return user


def _form_with_assessed_bags(n_bags):
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"CERTBAG-{_counter['val']:05d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    for _ in range(n_bags):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"CB-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )
    return form


@settings(max_examples=20, deadline=None)
@given(n_bags=st.integers(min_value=1, max_value=5))
def test_bags_covered_by_one_certificate(n_bags):
    """The certificate's covered bags equal exactly the form's bags, and each
    bag is covered by one and only one certificate."""
    SystemSettings.load()
    user = _make_user()
    form = _form_with_assessed_bags(n_bags)

    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        CertificateService.generate_certificate(form, user)

    form.refresh_from_db()
    cert = form.certificate

    # Certificate's bags (via form) match the form's bags exactly
    assert set(cert.form.bags.values_list("pk", flat=True)) == set(
        form.bags.values_list("pk", flat=True)
    )

    # Each bag is covered by exactly one certificate
    for bag in form.bags.all():
        covering = Certificate.objects.filter(form__bags=bag).distinct()
        assert covering.count() == 1
