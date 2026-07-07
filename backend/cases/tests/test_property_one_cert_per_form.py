"""Property 3: A generated form has exactly one certificate (R10.3).

**Validates: Requirements 10.3**

Generates a form with 1-5 assessed bags, calls generate_certificate g times
(g=1..3). Asserts exactly one Certificate exists for the form, and repeated
generation reuses the same pk/number.
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
        email="onecert@test.com",
        defaults={"password": "x"},
    )
    return user


def _form_with_assessed_bags(n_bags):
    """Create a form with n_bags assessed bags, ready for certificate generation."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"ONECERT-{_counter['val']:05d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    for i in range(n_bags):
        _counter["val"] += 1
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"OC-TAG-{_counter['val']:06d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )
    return form


@settings(max_examples=20, deadline=None)
@given(
    n_bags=st.integers(min_value=1, max_value=5),
    g=st.integers(min_value=1, max_value=3),
)
def test_form_has_single_certificate(n_bags, g):
    """However many times generation runs, the form has exactly one certificate
    with the same pk and number."""
    SystemSettings.load()
    user = _make_user()
    form = _form_with_assessed_bags(n_bags)

    pks = set()
    numbers = set()
    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        for _ in range(g):
            cert = CertificateService.generate_certificate(form, user)
            pks.add(cert.pk)
            numbers.add(cert.certificate_number)
            # Refresh to clear cached OneToOne
            form.refresh_from_db()

    assert Certificate.objects.filter(form=form).count() == 1
    assert len(pks) == 1
    assert len(numbers) == 1
