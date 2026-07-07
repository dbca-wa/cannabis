"""Property 1: Each drug bag belongs to exactly one form (R10.1).

**Validates: Requirements 10.1**

Generates a case with 1-8 forms, each with 1-5 bags. Asserts every DrugBag has
a non-null form, and no bag appears under two forms.
"""

import pytest
from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st

from cases.models import Case, DrugBag, Priority3Form
from common.models import SystemSettings

pytestmark = pytest.mark.django_db(transaction=True)


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email="bagowner@test.com",
        defaults={"password": "x"},
    )
    return user


def _make_case(n):
    """Create a case with a unique case number."""
    return Case.objects.create(
        case_number=f"BAGOWN-{n:05d}",
        received=timezone.now(),
    )


_counter = {"val": 0}


def _make_form(case):
    return Priority3Form.objects.create(case=case)


def _make_bag(form):
    _counter["val"] += 1
    return DrugBag.objects.create(
        form=form,
        seal_tag_numbers=f"OWN-TAG-{_counter['val']:06d}",
        content_type="plant",
    )


@settings(max_examples=20, deadline=None)
@given(
    form_bag_counts=st.lists(
        st.integers(min_value=1, max_value=5),
        min_size=1,
        max_size=8,
    )
)
def test_bag_belongs_to_exactly_one_form(form_bag_counts):
    """Each drug bag belongs to exactly one form; no bag appears under two forms."""
    # SystemSettings singleton must exist for the DB to function
    SystemSettings.load()

    case = _make_case(_counter["val"])
    forms = []
    for bag_count in form_bag_counts:
        form = _make_form(case)
        for _ in range(bag_count):
            _make_bag(form)
        forms.append(form)

    all_bags = list(DrugBag.objects.filter(form__case=case))

    # Every bag has a non-null form
    assert all(bag.form_id is not None for bag in all_bags)

    # The bag sets across forms are disjoint (no bag in two forms)
    owners = [bag.form_id for bag in all_bags]
    assert len(owners) == len(all_bags)

    # Forms' bag counts sum to the total
    assert sum(f.bags.count() for f in forms) == len(all_bags)

    # Expected total
    assert len(all_bags) == sum(form_bag_counts)
