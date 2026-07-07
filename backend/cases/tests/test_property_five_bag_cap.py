"""Property 2: A form has at most five drug bags (R10.2).

**Validates: Requirements 10.2**

Attempts to add k bags (k from 1..10) to a form via DrugBagService. Asserts
form.bags.count() == min(k, 5) and the service rejects bags beyond 5.
"""

import pytest
from django.utils import timezone
from hypothesis import given, settings
from hypothesis import strategies as st

from cases.models import Case, Priority3Form
from cases.services.drug_bag_service import DrugBagService
from common.models import SystemSettings

pytestmark = pytest.mark.django_db(transaction=True)

_counter = {"val": 0}


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email="bagcap@test.com",
        defaults={"password": "x"},
    )
    if not user.has_usable_password():
        user.set_password("x")
        user.save()
    return user


def _fresh_form():
    _counter["val"] += 1
    case = Case.objects.create(
        case_number=f"BAGCAP-{_counter['val']:05d}",
        received=timezone.now(),
    )
    return Priority3Form.objects.create(case=case)


@settings(max_examples=20, deadline=None)
@given(k=st.integers(min_value=1, max_value=10))
def test_form_caps_at_five_bags(k):
    """After attempting to add k bags, form holds min(k, 5) and the rest are rejected."""
    SystemSettings.load()
    user = _make_user()
    form = _fresh_form()

    added = 0
    rejected = 0
    for i in range(k):
        _counter["val"] += 1
        bag_data = {
            "seal_tag_numbers": f"CAP-TAG-{_counter['val']:06d}",
            "content_type": "plant",
        }
        try:
            DrugBagService.create_bag(form, bag_data, user)
            added += 1
        except Exception:
            rejected += 1

    assert form.bags.count() == min(k, 5)
    assert added == min(k, 5)
    assert rejected == max(0, k - 5)
