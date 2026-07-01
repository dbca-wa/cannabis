"""Tests for certificate generation (max five bags per certificate)."""

from unittest.mock import patch

import pytest
from django.urls import reverse

from cases.models import Certificate
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DrugBagFactory,
)

pytestmark = pytest.mark.django_db

PDF = "cases.services.certificate_service.PDFService._html_to_pdf"


def _case_with_assessed_bags(n):
    """A case in assessment with ``n`` assessed drug bags."""
    case = CaseFactory(phase="assessment")
    for _ in range(n):
        bag = DrugBagFactory(submission=case)
        BotanicalAssessmentFactory(drug_bag=bag)
    return case


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    """Write generated PDFs to a temp dir, not the real media root."""
    settings.MEDIA_ROOT = str(tmp_path)


class TestCertificateGeneration:
    def test_five_bags_single_certificate(self, finance_client):
        case = _case_with_assessed_bags(5)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("certificate_generate", kwargs={"pk": case.pk}),
                {},
                format="json",
            )
        assert resp.status_code == 201
        assert len(resp.data) == 1
        cert = Certificate.objects.get(submission=case)
        assert cert.bags.count() == 5

    def test_more_than_five_bags_multiple_certificates(self, finance_client):
        case = _case_with_assessed_bags(6)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("certificate_generate", kwargs={"pk": case.pk}),
                {},
                format="json",
            )
        assert resp.status_code == 201
        assert len(resp.data) == 2  # ceil(6 / 5)
        for cert in Certificate.objects.filter(submission=case):
            assert cert.bags.count() <= 5

    def test_certified_date_set_and_no_signature_fields(self, finance_client):
        case = _case_with_assessed_bags(1)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("certificate_generate", kwargs={"pk": case.pk}),
                {},
                format="json",
            )
        assert resp.status_code == 201
        assert resp.data[0]["certified_date"] is not None
        # The serialised certificate carries no signature artefacts.
        assert not any("sign" in key for key in resp.data[0])

    def test_regenerate_before_batching(self, finance_client):
        case = _case_with_assessed_bags(1)
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            gen = finance_client.post(
                reverse("certificate_generate", kwargs={"pk": case.pk}),
                {},
                format="json",
            )
            cert_id = gen.data[0]["id"]
            resp = finance_client.post(
                reverse(
                    "certificate_regenerate",
                    kwargs={"pk": case.pk, "certificate_id": cert_id},
                ),
                {},
                format="json",
            )
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        case = _case_with_assessed_bags(1)
        resp = roleless_client.post(
            reverse("certificate_generate", kwargs={"pk": case.pk}),
            {},
            format="json",
        )
        assert resp.status_code == 403
