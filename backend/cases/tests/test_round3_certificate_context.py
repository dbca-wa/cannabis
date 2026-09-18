"""Certificate wording: list conjunctions, and which officer appears where.

Section (a) names the conveying officer, adding an "on behalf of" clause only
when a requesting officer exists. Section (b) always names the conveying officer,
who was present at the examination.
"""

import pytest

from cases.services.certificate_service import CertificateService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
    Priority3FormFactory,
)
from common.utils import join_with_and

pytestmark = pytest.mark.django_db


def _certificate_with_bags(case=None, tag_specs=None):
    """A certificate whose form holds the given (seal, new_seal) bag pairs."""
    case = case or CaseFactory()
    form = Priority3FormFactory(case=case)
    for seal, new_seal in tag_specs or [("T001", "N001")]:
        bag = DrugBagFactory(
            form=form, seal_tag_numbers=seal, new_seal_tag_numbers=new_seal
        )
        BotanicalAssessmentFactory(drug_bag=bag)
    return CertificateFactory(form=form)


class TestJoinWithAnd:
    @pytest.mark.parametrize(
        "values,expected",
        [
            ([], ""),
            (["A"], "A"),
            (["A", "B"], "A and B"),
            (["A", "B", "C"], "A, B and C"),
            (["A", "B", "C", "D"], "A, B, C and D"),
            (["A", "", None, "D"], "A and D"),
            (["  A  ", " B "], "A and B"),
        ],
    )
    def test_reads_as_an_english_list(self, values, expected):
        assert join_with_and(values) == expected


class TestTagNumberWording:
    def test_one_tag_stands_alone(self):
        certificate = _certificate_with_bags(tag_specs=[("T001", "N001")])

        context = CertificateService.build_certificate_context(certificate)

        assert context["tag_numbers"] == "T001"
        assert context["new_tag_numbers"] == "N001"

    def test_two_tags_are_joined_with_and(self):
        certificate = _certificate_with_bags(
            tag_specs=[("T001", "N001"), ("T002", "N002")]
        )

        context = CertificateService.build_certificate_context(certificate)

        assert context["tag_numbers"] == "T001 and T002"
        assert context["new_tag_numbers"] == "N001 and N002"

    def test_three_tags_use_commas_then_and(self):
        certificate = _certificate_with_bags(
            tag_specs=[("T001", "N001"), ("T002", "N002"), ("T003", "N003")]
        )

        context = CertificateService.build_certificate_context(certificate)

        assert context["tag_numbers"] == "T001, T002 and T003"
        assert context["new_tag_numbers"] == "N001, N002 and N003"

    def test_missing_new_tags_are_skipped(self):
        certificate = _certificate_with_bags(
            tag_specs=[("T001", "N001"), ("T002", None)]
        )

        context = CertificateService.build_certificate_context(certificate)

        assert context["tag_numbers"] == "T001 and T002"
        assert context["new_tag_numbers"] == "N001"


class TestOfficerRoles:
    def test_conveying_officer_is_the_submitting_officer(self):
        station = PoliceStationFactory(name="Midland")
        conveying = PoliceOfficerFactory(
            last_name="Neutron", given_names="Jimmy", station=station
        )
        case = CaseFactory(submitting_officer=conveying)
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert "NEUTRON" in context["conveying_officer"]
        assert "Unsworn Officer" in context["conveying_officer"]

    def test_requesting_officer_is_absent_when_unset(self):
        case = CaseFactory(submitting_officer=PoliceOfficerFactory())
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert context["requesting_officer"] is None

    def test_no_placeholder_reaches_the_certificate_without_a_requesting_officer(
        self,
    ):
        """The old fallback printed "[Pending]" for a missing officer."""
        case = CaseFactory(submitting_officer=PoliceOfficerFactory())
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert context["requesting_officer"] != "[Pending]"
        assert "[Pending]" not in (context["conveying_officer"] or "")

    def test_requesting_officer_is_reported_when_set(self):
        conveying = PoliceOfficerFactory(last_name="Neutron")
        requesting = PoliceOfficerFactory(last_name="Lightyear")
        case = CaseFactory(submitting_officer=conveying, requesting_officer=requesting)
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert "LIGHTYEAR" in context["requesting_officer"]
        assert "Sworn Officer" in context["requesting_officer"]
        # The conveying officer stays the one the samples came from.
        assert "NEUTRON" in context["conveying_officer"]

    def test_requesting_officer_never_replaces_the_conveying_officer(self):
        """Section (b) reads the conveying officer, so they must not be swapped."""
        conveying = PoliceOfficerFactory(last_name="Neutron")
        requesting = PoliceOfficerFactory(last_name="Lightyear")
        case = CaseFactory(submitting_officer=conveying, requesting_officer=requesting)
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert "LIGHTYEAR" not in context["conveying_officer"]

    def test_the_removed_context_keys_are_gone(self):
        case = CaseFactory(submitting_officer=PoliceOfficerFactory())
        certificate = _certificate_with_bags(case=case)

        context = CertificateService.build_certificate_context(certificate)

        assert "police_officer" not in context
        assert "receiving_officer" not in context


class TestRenderedCertificate:
    def test_on_behalf_of_appears_only_with_a_requesting_officer(self):
        from django.template.loader import render_to_string

        conveying = PoliceOfficerFactory(last_name="Neutron")
        without = _certificate_with_bags(case=CaseFactory(submitting_officer=conveying))
        html = render_to_string(
            "pdf/certificate_template.html",
            CertificateService.build_certificate_context(without),
        )
        assert "on behalf of" not in html

        with_requesting = _certificate_with_bags(
            case=CaseFactory(
                submitting_officer=PoliceOfficerFactory(last_name="Neutron"),
                requesting_officer=PoliceOfficerFactory(last_name="Lightyear"),
            )
        )
        html = render_to_string(
            "pdf/certificate_template.html",
            CertificateService.build_certificate_context(with_requesting),
        )
        assert "on behalf of" in html
        assert "LIGHTYEAR" in html
