"""Tests for certificate generation (one certificate per Priority 3 form)."""

from unittest.mock import patch

import pytest
from django.urls import reverse

from cases.models import Certificate
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DrugBagFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

PDF = "cases.services.certificate_service.PDFService._html_to_pdf"


def _form_with_assessed_bags(n):
    """A form in assessment with ``n`` assessed drug bags."""
    case = CaseFactory()
    form = Priority3FormFactory(case=case, phase="assessment")
    for _ in range(n):
        bag = DrugBagFactory(form=form)
        BotanicalAssessmentFactory(drug_bag=bag)
    return form


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    """Write generated PDFs to a temp dir, not the real media root."""
    settings.MEDIA_ROOT = str(tmp_path)


class TestCertificateGeneration:
    def test_five_bags_single_certificate(self, finance_client):
        form = _form_with_assessed_bags(5)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("form_certificate_generate", kwargs={"pk": form.pk}),
                {},
                format="json",
            )
        assert resp.status_code == 201
        cert = Certificate.objects.get(form=form)
        assert cert.bags.count() == 5

    def test_certified_date_set_and_no_signature_fields(self, finance_client):
        form = _form_with_assessed_bags(1)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("form_certificate_generate", kwargs={"pk": form.pk}),
                {},
                format="json",
            )
        assert resp.status_code == 201
        assert resp.data["certified_date"] is not None
        # The serialised certificate carries no signature artefacts.
        assert not any("sign" in key for key in resp.data)

    def test_regenerate_before_batching(self, finance_client):
        form = _form_with_assessed_bags(1)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            finance_client.post(
                reverse("form_certificate_generate", kwargs={"pk": form.pk}),
                {},
                format="json",
            )
            cert = Certificate.objects.get(form=form)
            resp = finance_client.post(
                reverse(
                    "certificate_regenerate",
                    kwargs={"pk": form.case_id, "certificate_id": cert.pk},
                ),
                {},
                format="json",
            )
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        form = _form_with_assessed_bags(1)
        resp = roleless_client.post(
            reverse("form_certificate_generate", kwargs={"pk": form.pk}),
            {},
            format="json",
        )
        assert resp.status_code == 403
