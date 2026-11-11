"""Per-case certificate print options, their system defaults, and staleness.

Each case chooses whether the conveying and requesting officers' stations and
the requesting officer's rank print. New cases take the system defaults. A
generated certificate is flagged for regeneration when its wording version is
old or the officer text it would print has changed.
"""

import itertools
from unittest.mock import patch

import pytest
from django.urls import reverse

from cases.models import Batch
from cases.services import certificate_wording as wording
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

pytestmark = pytest.mark.django_db

PDF_PATCH = "cases.services.certificate_service.PDFService._html_to_pdf"
OPTIONS = (
    "print_conveying_station",
    "print_requesting_station",
    "print_requesting_rank",
)
DEFAULTS = tuple(f"default_{option}" for option in OPTIONS)


def _payload(**extra):
    return {
        "case_number": "CANN-PRINT-1",
        "received": "2026-11-01T09:00:00Z",
        **extra,
    }


class TestDefaultsOnNewCases:
    @pytest.mark.parametrize(
        "values", list(itertools.product([True, False], repeat=3)), ids=str
    )
    def test_omitted_options_take_the_system_defaults(
        self, values, finance_client, system_settings
    ):
        for field, value in zip(DEFAULTS, values):
            setattr(system_settings, field, value)
        system_settings.save()

        response = finance_client.post(reverse("case_list"), _payload(), format="json")

        assert response.status_code == 201, response.data
        case = CaseFactory._meta.model.objects.get(case_number="CANN-PRINT-1")
        assert tuple(getattr(case, option) for option in OPTIONS) == values

    def test_explicit_options_override_the_defaults(
        self, finance_client, system_settings
    ):
        payload = _payload(
            print_conveying_station=False,
            print_requesting_station=False,
            print_requesting_rank=True,
        )

        response = finance_client.post(reverse("case_list"), payload, format="json")

        assert response.status_code == 201, response.data
        case = CaseFactory._meta.model.objects.get(case_number="CANN-PRINT-1")
        assert (case.print_conveying_station, case.print_requesting_station) == (
            False,
            False,
        )
        assert case.print_requesting_rank is True

    def test_initial_defaults(self, system_settings):
        assert (
            system_settings.default_print_conveying_station,
            system_settings.default_print_requesting_station,
            system_settings.default_print_requesting_rank,
        ) == (True, True, False)

    def test_changing_a_default_leaves_existing_cases_alone(
        self, admin_client, system_settings
    ):
        case = CaseFactory()

        response = admin_client.patch(
            "/api/v1/system/settings",
            {"default_print_conveying_station": False},
            format="json",
        )

        assert response.status_code == 200
        case.refresh_from_db()
        assert case.print_conveying_station is True

    def test_options_can_be_edited_on_a_case(self, finance_client):
        case = CaseFactory()

        response = finance_client.patch(
            reverse("case_detail", kwargs={"pk": case.pk}),
            {"print_requesting_rank": True},
            format="json",
        )

        assert response.status_code == 200
        case.refresh_from_db()
        assert case.print_requesting_rank is True
        detail = finance_client.get(reverse("case_detail", kwargs={"pk": case.pk}))
        assert detail.data["print_requesting_rank"] is True


class TestSettingsAndFlags:
    def test_settings_report_and_update_the_defaults(
        self, admin_client, system_settings
    ):
        response = admin_client.get("/api/v1/system/settings")
        assert [response.data[field] for field in DEFAULTS] == [True, True, False]

        response = admin_client.patch(
            "/api/v1/system/settings",
            {
                "default_print_conveying_station": False,
                "default_print_requesting_rank": True,
            },
            format="json",
        )

        assert response.status_code == 200
        assert [response.data[field] for field in DEFAULTS] == [False, True, True]

    @pytest.mark.parametrize("bad", ["yes", 1, None, "maybe"])
    def test_non_boolean_defaults_are_rejected(
        self, bad, admin_client, system_settings
    ):
        response = admin_client.patch(
            "/api/v1/system/settings",
            {"default_print_requesting_rank": bad},
            format="json",
        )

        assert response.status_code == 400
        system_settings.refresh_from_db()
        assert system_settings.default_print_requesting_rank is False

    def test_a_change_is_logged_once(self, admin_client, system_settings):
        with patch("common.views.settings.logger.info") as info:
            admin_client.patch(
                "/api/v1/system/settings",
                {"default_print_requesting_station": False},
                format="json",
            )

        assert info.call_count == 1
        assert "default_print_requesting_station: True → False" in (
            info.call_args.args[0]
        )

    def test_non_admins_read_the_defaults_from_the_feature_flags(
        self, finance_client, system_settings
    ):
        response = finance_client.get("/api/v1/system/feature-flags")

        assert response.status_code == 200
        assert [response.data[field] for field in DEFAULTS] == [True, True, False]

    def test_app_roles_can_change_the_defaults(self, finance_client, system_settings):
        response = finance_client.patch(
            "/api/v1/system/settings",
            {"default_print_requesting_rank": True},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["default_print_requesting_rank"] is True

    def test_roleless_users_cannot_change_the_defaults(
        self, roleless_client, system_settings
    ):
        response = roleless_client.patch(
            "/api/v1/system/settings",
            {"default_print_requesting_rank": True},
            format="json",
        )

        assert response.status_code == 403


def _generated_case(**case_kwargs):
    """A case with one generated certificate, rendering stubbed."""
    case = CaseFactory(
        submitting_officer=PoliceOfficerFactory(
            station=PoliceStationFactory(name="Midland")
        ),
        requesting_officer=PoliceOfficerFactory(
            rank="senior_constable", station=PoliceStationFactory(name="Mandurah")
        ),
        **case_kwargs,
    )
    form = Priority3FormFactory(case=case)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    return case, form


def _generate(form, user):
    with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
        return CertificateService.generate_certificate(form, user)


class TestNeedsRegeneration:
    def test_a_fresh_certificate_is_current(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)

        assert certificate.wording_version == wording.CERTIFICATE_WORDING_VERSION
        assert certificate.printed_conveying_officer.endswith(" of Midland")
        assert certificate.printed_requesting_officer.startswith("Sworn Officer")
        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_an_older_wording_version_is_flagged(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)
        certificate.wording_version = 1
        certificate.save()

        assert CertificateService.needs_regeneration_reasons(certificate) == ["wording"]

    @pytest.mark.parametrize("option", OPTIONS)
    def test_changing_a_print_option_is_flagged(self, option, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)

        setattr(case, option, not getattr(case, option))
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == [
            "officers"
        ]

    def test_choosing_a_different_officer_is_flagged(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)

        case.submitting_officer = PoliceOfficerFactory()
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == [
            "officers"
        ]

    def test_removing_the_requesting_officer_is_flagged(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)

        case.requesting_officer = None
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == [
            "officers"
        ]

    def test_editing_the_officer_record_is_flagged(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)

        officer = case.submitting_officer
        officer.station = PoliceStationFactory(name="Joondalup")
        officer.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == [
            "officers"
        ]

    def test_an_unprinted_option_change_is_not_flagged(self, admin_user):
        """The rank option does nothing for an officer without a real rank."""
        case, form = _generated_case()
        case.requesting_officer.rank = "sworn_officer"
        case.requesting_officer.save()
        certificate = _generate(form, admin_user)

        case.print_requesting_rank = True
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_regenerating_clears_the_flag(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)
        case.print_requesting_rank = True
        case.save()

        certificate = _generate(form, admin_user)

        assert certificate.printed_requesting_officer.startswith("Senior Constable")
        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_a_batched_certificate_is_never_flagged(self, admin_user):
        case, form = _generated_case()
        certificate = _generate(form, admin_user)
        certificate.batch = Batch.objects.create()
        certificate.wording_version = 1
        certificate.save()
        case.print_conveying_station = False
        case.save()

        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_a_certificate_without_a_pdf_is_not_flagged(self):
        case, form = _generated_case()

        certificate = CertificateFactory(form=form)

        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_the_api_reports_the_reasons(self, admin_user, finance_client):
        case, form = _generated_case()
        _generate(form, admin_user)
        case.print_conveying_station = False
        case.save()

        response = finance_client.get(reverse("case_detail", kwargs={"pk": case.pk}))

        certificate = response.data["forms"][0]["certificate"]
        assert certificate["needs_regeneration"] is True
        assert certificate["regeneration_reasons"] == ["officers"]


class TestMigrations:
    @pytest.mark.parametrize(
        "module",
        [
            "cases.migrations.0041_certificate_print_options_and_wording",
            "common.migrations.0014_systemsettings_certificate_defaults",
        ],
    )
    def test_migrations_are_schema_only(self, module):
        """No data is rewritten: the degraded label and new fields are schema."""
        import importlib

        from django.db.migrations.operations import AddField, AlterField

        migration = importlib.import_module(module).Migration
        assert migration.operations
        assert all(
            isinstance(operation, (AddField, AlterField))
            for operation in migration.operations
        )

    def test_existing_certificates_start_as_outdated(self):
        """The field default marks pre-release certificates as old wording."""
        from cases.models import Certificate

        assert Certificate._meta.get_field("wording_version").default == 1
        assert wording.CERTIFICATE_WORDING_VERSION > 1

    def test_degraded_label_is_johns_wording(self):
        from cases.models import BotanicalAssessment

        assert BotanicalAssessment.DeterminationChoices.DEGRADED.label == (
            "Too degraded and could not be identified"
        )
