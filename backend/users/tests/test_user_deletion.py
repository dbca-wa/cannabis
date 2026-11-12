"""Users are never deleted through the app.

Deleting a person would strip them from the cases they worked on, so the API
refuses for everyone, superusers included. Accounts are deactivated instead; a
superuser can still delete one through Django admin or code.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from common.tests.factories import BotanistFactory, SuperuserFactory
from users.models import User

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("make_user", [SuperuserFactory, BotanistFactory])
def test_nobody_can_delete_a_user_through_the_app(make_user):
    client = APIClient()
    client.force_authenticate(user=make_user())
    target = BotanistFactory()

    resp = client.delete(reverse("user_detail", kwargs={"pk": target.pk}))

    assert resp.status_code == 403
    assert "Deactivate" in str(resp.data["detail"])
    assert User.objects.filter(pk=target.pk).exists()


def test_an_administrator_can_still_deactivate_a_user():
    client = APIClient()
    client.force_authenticate(user=SuperuserFactory())
    target = BotanistFactory()

    resp = client.patch(
        reverse("user_detail", kwargs={"pk": target.pk}),
        {"is_active": False},
        format="json",
    )

    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False
