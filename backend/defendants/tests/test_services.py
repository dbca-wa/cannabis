"""Service-layer tests for DefendantService."""

import pytest
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from cases.models import Submission
from defendants.models import Defendant
from defendants.services.defendant_service import DefendantService


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        email="def@test.com", password="x", first_name="D", last_name="U"
    )


@pytest.mark.django_db
class TestDefendantServiceGet:
    def test_get_defendant_success(self, defendant):
        result = DefendantService.get_defendant(defendant.pk)
        assert result.pk == defendant.pk

    def test_get_defendant_not_found(self):
        with pytest.raises(NotFound):
            DefendantService.get_defendant(999999)

    def test_get_queryset_basic(self, defendant):
        qs = DefendantService.get_queryset()
        assert defendant in list(qs)

    def test_get_queryset_search(self, defendant):
        Defendant.objects.create(given_names="Jane", last_name="Smith")
        qs = DefendantService.get_queryset(search="Doe")
        names = [d.last_name for d in qs]
        assert "Doe" in names
        assert "Smith" not in names

    def test_get_queryset_ordering_count(self, defendant):
        qs = DefendantService.get_queryset(ordering="-cases_count")
        assert list(qs) is not None

    def test_get_queryset_invalid_ordering(self, defendant):
        qs = DefendantService.get_queryset(ordering="bogus")
        assert defendant in list(qs)


@pytest.mark.django_db
class TestDefendantServiceCrud:
    def test_create_defendant(self, user):
        result = DefendantService.create_defendant(
            {"given_names": "New", "last_name": "Person"}, user
        )
        assert result.pk is not None

    def test_update_defendant(self, defendant, user):
        result = DefendantService.update_defendant(
            defendant, {"given_names": "Updated"}, user
        )
        assert result.given_names == "Updated"

    def test_delete_defendant_success(self, defendant, user):
        DefendantService.delete_defendant(defendant, user)
        assert not Defendant.objects.filter(pk=defendant.pk).exists()

    def test_delete_defendant_with_cases_raises(self, defendant, user):
        case = Submission.objects.create(
            case_number="DEF-CASE-1",
            received=timezone.now(),
            security_movement_envelope="ENV-D1",
        )
        case.defendants.add(defendant)
        with pytest.raises(ValidationError):
            DefendantService.delete_defendant(defendant, user)


@pytest.mark.django_db
class TestDefendantServiceMerge:
    def test_merge_requires_primary(self):
        with pytest.raises(ValidationError):
            DefendantService.merge_defendants(None, [1])

    def test_merge_requires_secondary(self, defendant):
        with pytest.raises(ValidationError):
            DefendantService.merge_defendants(defendant.pk, [])

    def test_merge_primary_in_secondary(self, defendant):
        with pytest.raises(ValidationError):
            DefendantService.merge_defendants(defendant.pk, [defendant.pk])

    def test_merge_missing_defendant(self, defendant):
        with pytest.raises(ValidationError):
            DefendantService.merge_defendants(defendant.pk, [999999])

    def test_merge_reassigns_cases(self, defendant):
        secondary = Defendant.objects.create(given_names="Sec", last_name="Ond")
        case = Submission.objects.create(
            case_number="MERGE-1",
            received=timezone.now(),
            security_movement_envelope="ENV-M1",
        )
        case.defendants.add(secondary)
        result = DefendantService.merge_defendants(defendant.pk, [secondary.pk])
        assert result["cases_reassigned"] == 1
        assert not Defendant.objects.filter(pk=secondary.pk).exists()
        assert defendant in case.defendants.all()


@pytest.mark.django_db
class TestDefendantServiceExport:
    def test_export_invalid_format(self, defendant, user):
        qs = DefendantService.get_queryset()
        with pytest.raises(ValidationError):
            DefendantService.export_defendants(qs, "xml", user)

    def test_export_csv(self, defendant, user):
        qs = DefendantService.get_queryset()
        response = DefendantService.export_defendants(qs, "csv", user)
        assert response["Content-Type"] == "text/csv"
        assert b"Doe" in response.content

    def test_export_json(self, defendant, user):
        qs = DefendantService.get_queryset()
        response = DefendantService.export_defendants(qs, "json", user)
        assert response["Content-Type"] == "application/json"
