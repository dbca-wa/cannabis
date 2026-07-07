"""Property 5: Every certificate number is unique (R10.5).

**Validates: Requirements 10.5**

Generates N forms (1-30) across cases, generates certificates in random order.
Asserts all certificate numbers are distinct.
"""

import random
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
        email="certuniq@test.com",
        defaults={"password": "x"},
    )
    return user


def _create_assessed_form():
    """Create a form with 1 assessed bag, ready for certificate generation."""
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"CERTUNIQ-{_counter['val']:05d}",
        received=timezone.now(),
    )
    form = Priority3Form.objects.create(case=case)
    _counter["val"] += 1
    bag = DrugBag.objects.create(
        form=form,
        seal_tag_numbers=f"CU-TAG-{_counter['val']:06d}",
        content_type="plant",
    )
    BotanicalAssessment.objects.create(
        drug_bag=bag,
        determination="cannabis_sativa",
    )
    return form


@settings(max_examples=20, deadline=None)
@given(n=st.integers(min_value=1, max_value=30))
def test_certificate_numbers_unique(n):
    """Generating n certificates in random order always produces distinct numbers."""
    SystemSettings.load()
    user = _make_user()

    forms = [_create_assessed_form() for _ in range(n)]
    random.shuffle(forms)

    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        for form in forms:
            CertificateService.generate_certificate(form, user)

    numbers = list(
        Certificate.objects.filter(form__in=forms).values_list(
            "certificate_number", flat=True
        )
    )
    assert len(numbers) == n
    assert len(set(numbers)) == n
