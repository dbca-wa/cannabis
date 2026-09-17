"""The cases list orders by creation date, newest first, by default.

Operators work through cases in the order they were entered, so the most
recently created case is the one most likely to need attention. Ordering by
workflow state remains available explicitly.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from common.tests.factories import CaseFactory

pytestmark = pytest.mark.django_db

CASES_URL = reverse("case_list")


def _cases_created_in_order():
    """Three cases with distinct creation times, oldest first."""
    now = timezone.now()
    created = []
    for index in range(3):
        case = CaseFactory(case_number=f"ORDER{index:03d}")
        # created_at is auto_now_add, so set it explicitly afterwards.
        stamp = now - timedelta(days=3 - index)
        type(case).objects.filter(pk=case.pk).update(created_at=stamp)
        case.refresh_from_db()
        created.append(case)
    return created


def _numbers(response):
    results = response.data.get("results", response.data)
    return [row["case_number"] for row in results]


class TestDefaultOrdering:
    def test_newest_created_comes_first(self, botanist_client):
        oldest, middle, newest = _cases_created_in_order()

        response = botanist_client.get(CASES_URL)

        assert response.status_code == 200
        assert _numbers(response) == [
            newest.case_number,
            middle.case_number,
            oldest.case_number,
        ]

    def test_an_unknown_ordering_falls_back_to_the_default(self, botanist_client):
        oldest, middle, newest = _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "nonsense"})

        assert response.status_code == 200
        assert _numbers(response) == [
            newest.case_number,
            middle.case_number,
            oldest.case_number,
        ]


class TestExplicitOrdering:
    def test_ascending_creation_date_is_accepted(self, botanist_client):
        oldest, middle, newest = _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "created_at"})

        assert _numbers(response) == [
            oldest.case_number,
            middle.case_number,
            newest.case_number,
        ]

    def test_descending_creation_date_is_accepted(self, botanist_client):
        oldest, middle, newest = _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "-created_at"})

        assert _numbers(response) == [
            newest.case_number,
            middle.case_number,
            oldest.case_number,
        ]

    def test_case_number_ordering_still_works(self, botanist_client):
        _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "case_number"})

        numbers = _numbers(response)
        assert numbers == sorted(numbers)

    def test_status_priority_ordering_is_still_available(self, botanist_client):
        _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "status_priority"})

        assert response.status_code == 200
        assert len(_numbers(response)) == 3

    def test_received_ordering_is_still_available(self, botanist_client):
        _cases_created_in_order()

        response = botanist_client.get(CASES_URL, {"ordering": "-received"})

        assert response.status_code == 200
        assert len(_numbers(response)) == 3


class TestSerialisedFields:
    def test_created_at_is_reported_so_the_column_can_render(self, botanist_client):
        _cases_created_in_order()

        response = botanist_client.get(CASES_URL)

        results = response.data.get("results", response.data)
        assert all(row.get("created_at") for row in results)
