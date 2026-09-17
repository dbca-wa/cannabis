"""Deleting a case: what it takes with it, what it must leave behind, and when
it must refuse.

Deleting cascades to the case's forms, their bags and assessments, and their
certificates. Officers, stations and defendants are shared records and must
survive. A case whose certificates are in a batch cannot be deleted at all,
because the batch's tallies and packaged documents depend on them.
"""

import pytest

from cases.models import Case, Certificate, DrugBag, Priority3Form
from cases.services.batch_service import BatchService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DefendantFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
    Priority3FormFactory,
)
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

pytestmark = pytest.mark.django_db


def _full_case(phase=Case.PhaseChoices.BATCHING):
    """A case with a station, both officers, a defendant, a form, a bag and a cert."""
    station = PoliceStationFactory()
    case = CaseFactory(
        station=station,
        submitting_officer=PoliceOfficerFactory(station=station),
        requesting_officer=PoliceOfficerFactory(station=station),
    )
    case.defendants.add(DefendantFactory())

    form = Priority3FormFactory(case=case, phase=phase)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    certificate = CertificateFactory(form=form)
    return case, form, bag, certificate


class TestWhatIsRemoved:
    def test_the_case_and_its_forms_bags_and_certificate_go(self, admin_client):
        case, form, bag, certificate = _full_case()

        response = admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert response.status_code == 204
        assert not Case.objects.filter(pk=case.pk).exists()
        assert not Priority3Form.objects.filter(pk=form.pk).exists()
        assert not DrugBag.objects.filter(pk=bag.pk).exists()
        assert not Certificate.objects.filter(pk=certificate.pk).exists()

    def test_the_bag_assessment_goes_with_the_bag(self, admin_client):
        from cases.models import BotanicalAssessment

        case, _form, bag, _cert = _full_case()
        assessment_pk = bag.assessment.pk

        admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert not BotanicalAssessment.objects.filter(pk=assessment_pk).exists()


class TestWhatIsKept:
    def test_officers_and_their_station_survive(self, admin_client):
        case, _form, _bag, _cert = _full_case()
        submitting_pk = case.submitting_officer_id
        requesting_pk = case.requesting_officer_id
        station_pk = case.station_id

        admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert PoliceOfficer.objects.filter(pk=submitting_pk).exists()
        assert PoliceOfficer.objects.filter(pk=requesting_pk).exists()
        assert PoliceStation.objects.filter(pk=station_pk).exists()

    def test_defendants_survive(self, admin_client):
        case, _form, _bag, _cert = _full_case()
        defendant_pk = case.defendants.first().pk

        admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert Defendant.objects.filter(pk=defendant_pk).exists()

    def test_other_cases_survive(self, admin_client):
        case, _form, _bag, _cert = _full_case()
        other, _f, _b, _c = _full_case()

        admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert Case.objects.filter(pk=other.pk).exists()


class TestBatchedCasesAreProtected:
    def test_deletion_is_refused_once_a_certificate_is_batched(
        self, admin_client, admin_user
    ):
        case, _form, _bag, certificate = _full_case()
        BatchService.create_batch([certificate.pk], admin_user)

        response = admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert response.status_code == 400
        assert Case.objects.filter(pk=case.pk).exists()

    def test_the_refusal_names_the_certificate(self, admin_client, admin_user):
        case, _form, _bag, certificate = _full_case()
        BatchService.create_batch([certificate.pk], admin_user)

        response = admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert certificate.certificate_number in str(response.data)

    def test_the_batch_keeps_its_certificate(self, admin_client, admin_user):
        case, _form, _bag, certificate = _full_case()
        batch = BatchService.create_batch([certificate.pk], admin_user)

        admin_client.delete(f"/api/v1/cases/{case.pk}")

        certificate.refresh_from_db()
        assert certificate.batch_id == batch.pk

    def test_an_unbatched_case_can_still_be_deleted(self, admin_client):
        case, _form, _bag, _cert = _full_case(phase=Case.PhaseChoices.ASSESSMENT)

        response = admin_client.delete(f"/api/v1/cases/{case.pk}")

        assert response.status_code == 204
        assert not Case.objects.filter(pk=case.pk).exists()
