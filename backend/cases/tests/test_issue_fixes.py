"""Tests for GitHub issue fixes #76 and #77."""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.template.loader import render_to_string
from django.utils import timezone

from cases.models import (
    Batch,
    BotanicalAssessment,
    Case,
    DrugBag,
    Priority3Form,
)
from cases.services.batch_service import BatchService
from cases.services.certificate_service import CertificateService
from common.models import SystemSettings

pytestmark = pytest.mark.django_db


@pytest.fixture
def sys_settings(db):
    return SystemSettings.load()


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(email="issuefix@test.com", password="x")


def _make_case(num):
    return Case.objects.create(
        case_number=f"ISSUE-{num}",
        received=timezone.now(),
    )


def _assessed_form(case, tag_prefix, n_bags=1, content_type="plant"):
    form = Priority3Form.objects.create(case=case)
    for i in range(n_bags):
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"{tag_prefix}-{i:03d}",
            content_type=content_type,
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )
    return form


class TestIssue77CertificateWording:
    """Issue #77: Certificate should say 'containing a quantity of <type>'."""

    def test_single_bag_contains_quantity_of(self, sys_settings, user):
        case = _make_case("077A")
        form = _assessed_form(case, "I77A", n_bags=1, content_type="plant")

        with patch(
            "cases.services.certificate_service.PDFService._html_to_pdf",
            return_value=b"%PDF",
        ):
            cert = CertificateService.generate_certificate(form, user)

        context = CertificateService.build_certificate_context(cert)
        html = render_to_string("pdf/certificate_template.html", context)

        assert "containing a quantity of" in html
        assert "containing Plant Material" not in html

    def test_multiple_bags_contains_quantity_of(self, sys_settings, user):
        case = _make_case("077B")
        form = _assessed_form(case, "I77B", n_bags=3, content_type="seed")

        with patch(
            "cases.services.certificate_service.PDFService._html_to_pdf",
            return_value=b"%PDF",
        ):
            cert = CertificateService.generate_certificate(form, user)

        context = CertificateService.build_certificate_context(cert)
        html = render_to_string("pdf/certificate_template.html", context)

        assert "containing a quantity of" in html
        assert "containing Seed" not in html


class TestIssue76CostSummaryDecimals:
    """Issue #76: Cost summary monetary amounts must have two decimal places."""

    def test_cost_summary_context_has_two_decimal_places(self, sys_settings, user):
        case = _make_case("076A")
        form = _assessed_form(case, "I76A", n_bags=2)

        with patch(
            "cases.services.certificate_service.PDFService._html_to_pdf",
            return_value=b"%PDF",
        ):
            cert = CertificateService.generate_certificate(form, user)

        batch = Batch.objects.create(
            cert_rate=Decimal("50.00"),
            bag_rate=Decimal("10.00"),
            tax_percentage=Decimal("10.00"),
            certificate_count=1,
            bag_count=2,
            cert_cost=Decimal("50.00"),
            bag_cost=Decimal("20.00"),
            subtotal=Decimal("70.00"),
            tax_amount=Decimal("7.00"),
            total=Decimal("77.00"),
        )
        cert.batch = batch
        cert.save(update_fields=["batch"])

        context = BatchService.build_cost_summary_context(batch)

        # All monetary values must be strings with exactly 2 decimal places
        assert context["cert_rate"] == "50.00"
        assert context["bag_rate"] == "10.00"
        assert context["cert_cost"] == "50.00"
        assert context["bag_cost"] == "20.00"
        assert context["subtotal"] == "70.00"
        assert context["tax_amount"] == "7.00"
        assert context["total"] == "77.00"

    def test_cost_summary_fractional_amounts(self, sys_settings, user):
        """Amounts like $12.50 should render as '12.50' not '12.5'."""
        case = _make_case("076B")
        form = _assessed_form(case, "I76B", n_bags=1)

        with patch(
            "cases.services.certificate_service.PDFService._html_to_pdf",
            return_value=b"%PDF",
        ):
            cert = CertificateService.generate_certificate(form, user)

        batch = Batch.objects.create(
            cert_rate=Decimal("12.50"),
            bag_rate=Decimal("7.50"),
            tax_percentage=Decimal("10.00"),
            certificate_count=1,
            bag_count=1,
            cert_cost=Decimal("12.50"),
            bag_cost=Decimal("7.50"),
            subtotal=Decimal("20.00"),
            tax_amount=Decimal("2.00"),
            total=Decimal("22.00"),
        )
        cert.batch = batch
        cert.save(update_fields=["batch"])

        context = BatchService.build_cost_summary_context(batch)

        assert context["cert_rate"] == "12.50"
        assert context["bag_rate"] == "7.50"
        assert context["cert_cost"] == "12.50"
        assert context["bag_cost"] == "7.50"
