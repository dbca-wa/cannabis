"""Service-layer tests for police officer and station services."""

import pytest
from rest_framework.exceptions import NotFound, ValidationError

from police.models import PoliceOfficer, PoliceStation
from police.services.officer_service import OfficerService
from police.services.station_service import StationService


class _Params(dict):
    """Dict subclass mimicking request.query_params (.get works as-is)."""


@pytest.mark.django_db
class TestStationServiceGet:
    """Tests for StationService.get_station."""

    def test_get_station_success(self, police_station):
        result = StationService.get_station(police_station.pk)
        assert result.pk == police_station.pk

    def test_get_station_not_found(self):
        with pytest.raises(NotFound):
            StationService.get_station(999999)


@pytest.mark.django_db
class TestStationServiceFiltering:
    """Tests for StationService.get_filtered_queryset."""

    def test_search_by_name(self, police_station):
        PoliceStation.objects.create(name="Northbridge", address="9 North St")
        qs = StationService.get_filtered_queryset(_Params(search="Central"))
        names = [s.name for s in qs]
        assert "Central Police Station" in names
        assert "Northbridge" not in names

    def test_search_by_address(self, police_station):
        qs = StationService.get_filtered_queryset(_Params(search="Main"))
        assert police_station in list(qs)

    def test_filter_has_officers_true(self, police_officer, police_station):
        empty = PoliceStation.objects.create(name="Empty", address="0 Nowhere")
        qs = StationService.get_filtered_queryset(_Params(has_officers="true"))
        assert police_station in list(qs)
        assert empty not in list(qs)

    def test_filter_has_officers_false(self, police_officer, police_station):
        empty = PoliceStation.objects.create(name="Empty", address="0 Nowhere")
        qs = StationService.get_filtered_queryset(_Params(has_officers="false"))
        assert empty in list(qs)
        assert police_station not in list(qs)

    def test_ordering_by_name_desc(self, police_station):
        PoliceStation.objects.create(name="Zzz Station", address="1 Z St")
        qs = StationService.get_filtered_queryset(_Params(ordering="-name"))
        assert qs[0].name == "Zzz Station"

    def test_ordering_by_case_count(self, police_station):
        qs = StationService.get_filtered_queryset(_Params(ordering="-case_count"))
        assert list(qs) is not None

    def test_default_ordering(self, police_station):
        qs = StationService.get_filtered_queryset(_Params())
        assert list(qs) is not None


@pytest.mark.django_db
class TestStationServiceExport:
    """Tests for StationService.get_export_queryset."""

    def test_export_basic(self, police_station):
        qs = StationService.get_export_queryset(_Params())
        assert police_station in list(qs)

    def test_export_search(self, police_station):
        qs = StationService.get_export_queryset(_Params(search="Central"))
        assert police_station in list(qs)

    def test_export_ordering_officer_count(self, police_station):
        qs = StationService.get_export_queryset(_Params(ordering="-officer_count"))
        assert list(qs) is not None


@pytest.mark.django_db
class TestStationServiceMerge:
    """Tests for StationService.merge_stations."""

    def test_merge_requires_primary(self):
        with pytest.raises(ValidationError):
            StationService.merge_stations(None, [1])

    def test_merge_requires_secondary(self, police_station):
        with pytest.raises(ValidationError):
            StationService.merge_stations(police_station.pk, [])

    def test_merge_primary_in_secondary(self, police_station):
        with pytest.raises(ValidationError):
            StationService.merge_stations(police_station.pk, [police_station.pk])

    def test_merge_missing_station(self, police_station):
        with pytest.raises(NotFound):
            StationService.merge_stations(police_station.pk, [999999])

    def test_merge_transfers_officers(self, police_station, police_officer):
        secondary = PoliceStation.objects.create(name="Sec", address="2 St")
        moved = PoliceOfficer.objects.create(
            badge_number="B999", first_name="Jane", last_name="Doe", station=secondary
        )
        result = StationService.merge_stations(police_station.pk, [secondary.pk])
        assert result["officers_reassigned"] == 1
        moved.refresh_from_db()
        assert moved.station_id == police_station.pk
        assert not PoliceStation.objects.filter(pk=secondary.pk).exists()


@pytest.mark.django_db
class TestOfficerServiceGet:
    """Tests for OfficerService.get_officer."""

    def test_get_officer_success(self, police_officer):
        result = OfficerService.get_officer(police_officer.pk)
        assert result.pk == police_officer.pk

    def test_get_officer_not_found(self):
        with pytest.raises(NotFound):
            OfficerService.get_officer(999999)


@pytest.mark.django_db
class TestOfficerServiceFiltering:
    """Tests for OfficerService.get_filtered_queryset."""

    def test_search_multi_word(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(search="John Smith"))
        assert police_officer in list(qs)

    def test_filter_by_rank(self, police_officer):
        qs = OfficerService.get_filtered_queryset(
            _Params(rank=PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE)
        )
        assert police_officer in list(qs)

    def test_filter_is_sworn_true(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(is_sworn="true"))
        assert police_officer in list(qs)

    def test_filter_is_sworn_false(self, police_station):
        unsworn = PoliceOfficer.objects.create(
            badge_number="U1",
            first_name="Un",
            last_name="Sworn",
            rank=PoliceOfficer.SeniorityChoices.UNSWORN_OFFICER,
            station=police_station,
        )
        qs = OfficerService.get_filtered_queryset(_Params(is_sworn="false"))
        assert unsworn in list(qs)

    def test_filter_by_station(self, police_officer, police_station):
        qs = OfficerService.get_filtered_queryset(
            _Params(station=str(police_station.pk))
        )
        assert police_officer in list(qs)

    def test_filter_no_station(self, police_station):
        no_station = PoliceOfficer.objects.create(
            badge_number="N1", first_name="No", last_name="Station"
        )
        qs = OfficerService.get_filtered_queryset(_Params(no_station="true"))
        assert no_station in list(qs)

    def test_filter_unknown_only(self, police_station):
        unknown = PoliceOfficer.objects.create(
            badge_number="UK1",
            first_name="Unk",
            last_name="Nown",
            rank=PoliceOfficer.SeniorityChoices.UNKNOWN,
            station=police_station,
        )
        qs = OfficerService.get_filtered_queryset(_Params(unknown_only="true"))
        assert unknown in list(qs)

    def test_exclude_unknown(self, police_officer, police_station):
        unknown = PoliceOfficer.objects.create(
            badge_number="UK2",
            first_name="Unk",
            last_name="Nown",
            rank=PoliceOfficer.SeniorityChoices.UNKNOWN,
            station=police_station,
        )
        qs = OfficerService.get_filtered_queryset(_Params(include_unknown="false"))
        assert unknown not in list(qs)
        assert police_officer in list(qs)

    def test_ordering_by_rank(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(ordering="rank"))
        assert list(qs) is not None

    def test_ordering_by_rank_desc(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(ordering="-rank"))
        assert list(qs) is not None

    def test_ordering_by_station(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(ordering="station"))
        assert list(qs) is not None

    def test_ordering_by_case_count(self, police_officer):
        qs = OfficerService.get_filtered_queryset(_Params(ordering="-case_count"))
        assert list(qs) is not None


@pytest.mark.django_db
class TestOfficerServiceExport:
    """Tests for OfficerService.get_export_queryset."""

    def test_export_basic(self, police_officer):
        qs = OfficerService.get_export_queryset(_Params())
        assert police_officer in list(qs)

    def test_export_search(self, police_officer):
        qs = OfficerService.get_export_queryset(_Params(search="Smith"))
        assert police_officer in list(qs)

    def test_export_filter_station_none(self, police_station):
        no_station = PoliceOfficer.objects.create(
            badge_number="X1", first_name="No", last_name="Stn"
        )
        qs = OfficerService.get_export_queryset(_Params(station="none"))
        assert no_station in list(qs)

    def test_export_filter_station_id(self, police_officer, police_station):
        qs = OfficerService.get_export_queryset(_Params(station=str(police_station.pk)))
        assert police_officer in list(qs)

    def test_export_filter_station_invalid(self, police_officer):
        qs = OfficerService.get_export_queryset(_Params(station="notanumber"))
        assert list(qs) is not None

    def test_export_filter_by_rank(self, police_officer):
        qs = OfficerService.get_export_queryset(
            _Params(rank=PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE)
        )
        assert police_officer in list(qs)

    def test_export_unknown_only(self, police_station):
        unknown = PoliceOfficer.objects.create(
            badge_number="UK3",
            first_name="U",
            last_name="K",
            rank=PoliceOfficer.SeniorityChoices.UNKNOWN,
            station=police_station,
        )
        qs = OfficerService.get_export_queryset(_Params(unknown_only="true"))
        assert unknown in list(qs)

    def test_export_ordering_rank(self, police_officer):
        qs = OfficerService.get_export_queryset(_Params(ordering="-rank"))
        assert list(qs) is not None


@pytest.mark.django_db
class TestOfficerServiceMerge:
    """Tests for OfficerService.merge_officers."""

    def test_merge_requires_both_ids(self, police_officer):
        with pytest.raises(ValidationError):
            OfficerService.merge_officers(None, police_officer.pk)

    def test_merge_same_officer(self, police_officer):
        with pytest.raises(ValidationError):
            OfficerService.merge_officers(police_officer.pk, police_officer.pk)

    def test_merge_source_not_found(self, police_officer):
        with pytest.raises(NotFound):
            OfficerService.merge_officers(999999, police_officer.pk)

    def test_merge_target_not_found(self, police_officer):
        with pytest.raises(NotFound):
            OfficerService.merge_officers(police_officer.pk, 999999)

    def test_merge_success(self, police_officer, police_station):
        target = PoliceOfficer.objects.create(
            badge_number="T1",
            first_name="Target",
            last_name="Officer",
            station=police_station,
        )
        result = OfficerService.merge_officers(police_officer.pk, target.pk)
        assert result["merged_into"] == target.pk
        assert not PoliceOfficer.objects.filter(pk=police_officer.pk).exists()
