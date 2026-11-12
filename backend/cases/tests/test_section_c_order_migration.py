"""Migration 0047: finished certificates adopt the new Section C order."""

import importlib
from unittest.mock import patch

import pytest
from django.apps import apps

from cases.models import Batch, DrugBag
from cases.services.certificate_service import CertificateService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

migration = importlib.import_module(
    "cases.migrations.0047_fingerprints_for_section_c_order"
)

CERT_PDF = "cases.services.certificate_service.PDFService._html_to_pdf"

# What Section C printed for the form below before the reorder and grouping.
PREVIOUSLY_PRINTED = (
    "Bag T2 was inconclusive.\n"
    "Bag T3 was inconclusive.\n"
    "Subsamples placed into Security Movement Envelope WW1.\n"
    "Handed back.\n"
    "Bag T1 contained female plants."
)


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _printed_before_the_reorder(admin_user, phase):
    """A batched certificate whose stored fingerprint is the old Section C."""
    case = CaseFactory(submitting_officer=PoliceOfficerFactory())
    form = Priority3FormFactory(
        case=case, security_movement_envelope="WW1", additional_notes="Handed back."
    )
    for i, result in enumerate(
        ("cannabis_sativa", "inconclusive", "inconclusive"), start=1
    ):
        BotanicalAssessmentFactory(
            drug_bag=DrugBagFactory(form=form, seal_tag_numbers=f"T{i}"),
            determination=result,
        )
    DrugBag.objects.filter(form=form, seal_tag_numbers="T1").update(
        contains_female_plants=True
    )
    with patch(CERT_PDF, return_value=b"%PDF-1.4 test"):
        certificate = CertificateService.generate_certificate(form, admin_user)
    certificate.batch = Batch.objects.create()
    context = CertificateService.build_certificate_context(certificate)
    context["other_matters"] = PREVIOUSLY_PRINTED
    certificate.printed_fingerprint = CertificateService.fingerprint_context(context)
    certificate.save()
    form.phase = phase
    form.save()
    return certificate


def test_the_new_section_c_differs():
    """Guards the fixture: the reorder really changes this form's Section C."""
    assert (
        migration._previous_section_c(
            migration._previous_bag_lines(
                [
                    ("T1", "cannabis_sativa"),
                    ("T2", "inconclusive"),
                    ("T3", "inconclusive"),
                ]
            ),
            "Handed back.",
            "Bag T1 contained female plants.",
            "Subsamples placed into Security Movement Envelope WW1.",
            lambda line: line.startswith("Subsamples placed"),
        )
        == PREVIOUSLY_PRINTED
    )


def test_finished_work_takes_its_current_state(admin_user):
    certificate = _printed_before_the_reorder(admin_user, "complete")
    assert CertificateService.needs_repackage(certificate) is True

    migration.adopt_section_c_order(apps, None)
    certificate.refresh_from_db()

    assert CertificateService.needs_repackage(certificate) is False


def test_a_batch_still_in_progress_needs_a_repackage(admin_user):
    certificate = _printed_before_the_reorder(admin_user, "in_batch")
    before = certificate.printed_fingerprint

    migration.adopt_section_c_order(apps, None)
    certificate.refresh_from_db()

    assert certificate.printed_fingerprint == before
    assert CertificateService.needs_repackage(certificate) is True


def test_finished_work_that_already_differed_still_shows(admin_user):
    certificate = _printed_before_the_reorder(admin_user, "complete")
    case = certificate.form.case
    case.case_number = "CHANGED-1"
    case.save()

    migration.adopt_section_c_order(apps, None)
    certificate.refresh_from_db()

    assert CertificateService.needs_repackage(certificate) is True
