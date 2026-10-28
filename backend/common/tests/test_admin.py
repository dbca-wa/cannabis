"""Smoke tests for every registered Django admin.

Builds a real case chain and a practice case chain, then drives each admin the
way a superuser would: changelists (every sort column and filter choice, and
search), add/change/history/delete pages, and re-saving each change form
unchanged. Any 500, permission dead end or hidden row fails the test.
"""

from datetime import timedelta
from html.parser import HTMLParser

import pytest
from django.contrib import admin
from django.test import RequestFactory
from django.utils import timezone

from common.tests.factories import (
    BotanicalAssessmentFactory,
    CertificateFactory,
    DefendantFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    Priority3FormFactory,
    SuperuserFactory,
)

REGISTERED = sorted(admin.site._registry.items(), key=lambda item: item[0]._meta.label)


class _ChangeFormParser(HTMLParser):
    """Collect the values a browser would submit from an admin change form."""

    def __init__(self, form_id):
        super().__init__()
        self.form_id, self.in_form, self.data = form_id, False, {}
        self._select = self._first_option = self._textarea = None
        self._selected = False
        self._text = ""

    def _add(self, name, value):
        self.data.setdefault(name, []).append(value)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form" and a.get("id") == self.form_id:
            self.in_form = True
        if not self.in_form:
            return
        name = a.get("name")
        if tag == "input" and name:
            kind = (a.get("type") or "text").lower()
            if kind in ("submit", "button", "file", "image", "reset"):
                return
            if kind in ("checkbox", "radio") and "checked" not in a:
                return
            self._add(name, a.get("value", "on" if kind == "checkbox" else ""))
        elif tag == "select" and name:
            self._select, self._first_option, self._selected = name, None, False
            self._multiple = "multiple" in a
        elif tag == "option" and self._select:
            if self._first_option is None:
                self._first_option = a.get("value", "")
            if "selected" in a:
                self._add(self._select, a.get("value", ""))
                self._selected = True
        elif tag == "textarea" and name:
            self._textarea, self._text = name, ""

    def handle_endtag(self, tag):
        if tag == "form":
            self.in_form = False
        elif tag == "select" and self._select:
            if not self._selected and not self._multiple:
                self._add(self._select, self._first_option or "")
            self._select = None
        elif tag == "textarea" and self._textarea:
            self._add(self._textarea, self._text.removeprefix("\n"))
            self._textarea = None

    def handle_data(self, data):
        if self._textarea:
            self._text += data


def _case_chain(**stamp):
    """A case with its officer, station, defendant, form, bag, assessment and
    certificate."""
    officer = PoliceOfficerFactory(
        station__is_practice=stamp.get("is_practice", False),
        station__practice_owner=stamp.get("practice_owner"),
        **stamp,
    )
    form = Priority3FormFactory(
        case__requesting_officer=officer,
        case__station=officer.station,
        **{f"case__{k}": v for k, v in stamp.items()},
        **stamp,
    )
    form.case.defendants.add(DefendantFactory(**stamp))
    bag = DrugBagFactory(form=form, **stamp)
    BotanicalAssessmentFactory(drug_bag=bag, **stamp)
    CertificateFactory(form=form, **stamp)
    return form.case


@pytest.fixture
def admin_data(db, system_settings):
    from django.contrib.admin.models import CHANGE, LogEntry
    from django.contrib.contenttypes.models import ContentType

    from cases.models import Batch, CaseDraft, CasePhaseHistory, SectionCTemplate
    from users.models import InviteRecord, PasswordResetCode

    superuser = SuperuserFactory()
    practice_owner = SuperuserFactory()
    real_case = _case_chain()
    _case_chain(is_practice=True, practice_owner=practice_owner)
    form = real_case.forms.first()
    CasePhaseHistory.objects.create(
        submission=real_case,
        form=form,
        from_phase="assessment",
        to_phase="unsigned_generation",
        action="advance",
        user=superuser,
    )
    Batch.objects.create(created_by=superuser)
    Batch.all_objects.create(
        created_by=practice_owner, is_practice=True, practice_owner=practice_owner
    )
    SectionCTemplate.objects.create(name="Standard", content="Template body")
    CaseDraft.objects.create(user=superuser, data={"step": 1}, current_step=1)
    InviteRecord.objects.create(
        email="invitee@example.com",
        invited_by=superuser,
        role="botanist",
        token="tok-1",
        expires_at=timezone.now() + timedelta(days=1),
        external_user_data={},
    )
    PasswordResetCode.objects.create(user=superuser, code_hash="hash")
    LogEntry.objects.create(
        user=superuser,
        content_type=ContentType.objects.get_for_model(real_case),
        object_id=str(real_case.pk),
        object_repr=str(real_case),
        action_flag=CHANGE,
    )
    return {"superuser": superuser, "real_case": real_case}


def _admin_request(user, path="/"):
    request = RequestFactory().get(path)
    request.user = user
    return request


def _form_errors(response):
    ctx = response.context
    errors = [dict(ctx["adminform"].form.errors)] if ctx and "adminform" in ctx else []
    for inline in (ctx or {}).get("inline_admin_formsets", []):
        errors += [e for e in inline.formset.errors if e] + list(
            inline.formset.non_form_errors()
        )
    return errors


@pytest.mark.parametrize(
    "model,model_admin", REGISTERED, ids=lambda v: getattr(v, "__name__", "")
)
def test_admin_changelist(client, admin_data, model, model_admin):
    """Changelist renders for every sort column, filter choice and a search."""
    client.force_login(admin_data["superuser"])
    opts = model._meta
    base = f"/admin/{opts.app_label}/{opts.model_name}/"
    request = _admin_request(admin_data["superuser"], base)

    urls = [base, f"{base}?q=a"]
    for index, _ in enumerate(model_admin.get_list_display(request)):
        urls += [f"{base}?o={index}", f"{base}?o=-{index}"]
    changelist = model_admin.get_changelist_instance(request)
    for spec in changelist.filter_specs:
        urls += [
            base + c["query_string"]
            for c in spec.choices(changelist)
            if c.get("query_string")
        ]

    for url in urls:
        assert client.get(url).status_code == 200, url


@pytest.mark.parametrize(
    "model,model_admin", REGISTERED, ids=lambda v: getattr(v, "__name__", "")
)
def test_admin_object_pages(client, admin_data, model, model_admin):
    """Add, change, history and delete pages render, and unchanged saves succeed."""
    user = admin_data["superuser"]
    client.force_login(user)
    opts = model._meta
    base = f"/admin/{opts.app_label}/{opts.model_name}/"
    request = _admin_request(user, base)

    if model_admin.has_add_permission(request):
        assert client.get(f"{base}add/").status_code == 200

    for obj in model._base_manager.all():
        change_url = f"{base}{obj.pk}/change/"
        response = client.get(change_url)
        assert response.status_code == 200, change_url
        assert client.get(f"{base}{obj.pk}/history/").status_code == 200
        if model_admin.has_delete_permission(request, obj):
            assert client.get(f"{base}{obj.pk}/delete/").status_code == 200, change_url
        if model_admin.has_change_permission(request, obj):
            parser = _ChangeFormParser(f"{opts.model_name}_form")
            parser.feed(response.content.decode())
            saved = client.post(change_url, {**parser.data, "_save": "Save"})
            assert saved.status_code == 302, (change_url, _form_errors(saved))


def test_admin_lists_every_row(admin_data):
    """Practice rows are visible in the admin alongside real ones."""
    request = _admin_request(admin_data["superuser"])
    for model, model_admin in REGISTERED:
        expected = model._base_manager.count()
        assert model_admin.get_queryset(request).count() == expected, model._meta.label


def test_admin_registers_every_project_model():
    from django.apps import apps

    framework_internal = {
        "auth.Permission",
        "contenttypes.ContentType",
        "sessions.Session",
    }
    unregistered = {
        m._meta.label for m in apps.get_models() if m not in admin.site._registry
    } - framework_internal
    assert not unregistered


def test_admin_can_delete_case_with_history(client, admin_data):
    """Deleting a case cascades through its phase history without a 403."""
    from cases.models import Case

    client.force_login(admin_data["superuser"])
    case = admin_data["real_case"]
    response = client.post(
        f"/admin/submissions/case/{case.pk}/delete/", {"post": "yes"}
    )
    assert response.status_code == 302
    assert not Case.all_objects.filter(pk=case.pk).exists()


def test_defendant_admin_shows_creator(client, admin_data):
    """The defendant changelist and change page name the user who created it."""
    user = admin_data["superuser"]
    client.force_login(user)
    defendant = DefendantFactory(
        given_names="Unknown", last_name="Unknown", created_by=user
    )
    non_creator = SuperuserFactory()

    changelist = client.get("/admin/defendants/defendant/", {"q": "Unknown"})
    assert changelist.status_code == 200
    assert user.email in changelist.content.decode()

    # The creator filter offers only users who have created a defendant
    filtered = client.get(
        "/admin/defendants/defendant/", {"created_by__id__exact": user.pk}
    )
    assert filtered.status_code == 200
    assert list(filtered.context["cl"].queryset) == [defendant]
    choices = [
        c["display"]
        for spec in filtered.context["cl"].filter_specs
        if spec.title == "created by"
        for c in spec.choices(filtered.context["cl"])
    ]
    assert str(user) in choices
    assert str(non_creator) not in choices

    blank = client.get("/admin/defendants/defendant/", {"created_by__isnull": "True"})
    assert blank.status_code == 200
    assert defendant not in blank.context["cl"].queryset

    change = client.get(f"/admin/defendants/defendant/{defendant.pk}/change/")
    assert change.status_code == 200
    assert "Record history" in change.content.decode()
    assert user.email in change.content.decode()


def test_defendant_creator_filter_shows_without_creators(client, admin_data):
    """The created-by filter renders even when no defendant has a creator yet."""
    client.force_login(admin_data["superuser"])
    response = client.get("/admin/defendants/defendant/")
    assert response.status_code == 200
    titles = [spec.title for spec in response.context["cl"].filter_specs]
    assert "created by" in titles
    assert "By created by" in response.content.decode()
