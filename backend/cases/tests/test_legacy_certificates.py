"""Legacy forms never get a certificate made in this app.

The old system certified them and those certificates may have been presented
in court; issuing another would create a second document for one examination.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import BotanicalAssessment, Case, Certificate, DrugBag, Priority3Form
from cases.services.certificate_service import CertificateService
from common.models import SystemSettings

PDF_PATCH = "cases.services.certificate_service.CertificateService._render_pdf"

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _form(case_number, legacy_number=""):
    SystemSettings.load()
    case = Case.objects.create(
        case_number=case_number,
        received=timezone.now(),
        is_legacy=bool(legacy_number),
    )
    form = Priority3Form.objects.create(
        case=case,
        phase=(
            Case.PhaseChoices.COMPLETE
            if legacy_number
            else Case.PhaseChoices.ASSESSMENT
        ),
        legacy_certificate_number=legacy_number,
    )
    bag = DrugBag.objects.create(form=form, seal_tag_numbers=f"{case_number}-1")
    BotanicalAssessment.objects.create(drug_bag=bag, determination="cannabis_sativa")
    return form


def test_service_refuses_a_legacy_form_and_uses_no_number(admin_user):
    form = _form("LEG-1", legacy_number="841")
    counter_before = SystemSettings.load().certificate_counter
    with patch(PDF_PATCH, return_value=b"%PDF-1.4"):
        with pytest.raises(ValidationError, match="certificate 841"):
            CertificateService.generate_certificate(form, admin_user)
    assert not Certificate.all_objects.exists()
    assert SystemSettings.load().certificate_counter == counter_before


def test_regenerating_an_existing_certificate_on_a_legacy_form_is_refused(admin_user):
    form = _form("LEG-3")
    with patch(PDF_PATCH, return_value=b"%PDF-1.4"):
        certificate = CertificateService.generate_certificate(form, admin_user)
    # A form later found to be legacy (for example after a re-import) is locked too.
    Priority3Form.all_objects.filter(pk=form.pk).update(legacy_certificate_number="900")
    certificate.refresh_from_db()
    with patch(PDF_PATCH, return_value=b"%PDF-1.4"):
        with pytest.raises(ValidationError, match="certificate 900"):
            CertificateService.regenerate_certificate_pdf(certificate, admin_user)


def test_generate_endpoint_refuses_a_legacy_form_for_an_admin(admin_client):
    form = _form("LEG-4", legacy_number="843")
    with patch(PDF_PATCH, return_value=b"%PDF-1.4"):
        response = admin_client.post(
            reverse("form_certificate_generate", kwargs={"pk": form.pk}),
            {},
            format="json",
        )
    assert response.status_code == 400
    assert "843" in str(response.data)
    assert not Certificate.all_objects.exists()


def test_app_forms_still_generate(admin_user):
    form = _form("APP-1")
    with patch(PDF_PATCH, return_value=b"%PDF-1.4"):
        certificate = CertificateService.generate_certificate(form, admin_user)
    assert certificate.certificate_number.startswith("R")
