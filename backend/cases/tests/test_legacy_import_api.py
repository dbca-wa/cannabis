"""The Settings page legacy import: maintainers only, bundle validation, tasks."""

import io
import json
import zipfile

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from cases.legacy_import import jobs
from cases.models import Case, LegacyImportBundle, LegacyImportRun, LegacySourceRecord
from etl.bundle import EXCEPTIONS, FORMAT, RULE_FILES, SOURCE_TABLE, _sha256
from users.models import User

pytestmark = pytest.mark.django_db


def _row(number, reference, tag):
    return {
        "Certificate Number": number,
        "Receipt Date": "2005-03-02T00:00:00",
        "Certification Date": "2005-03-04T00:00:00",
        "Identification Fee": "$0.00",
        "MailMerge": False,
        "Approved Botanist": "Nicholas Lander",
        "Police Reference Number": reference,
        "Location": None,
        "Quantity of Bags": "one",
        "Tag Number": tag,
        "Description": "quantity of plant",
        "Defendant": "KENMORE, Ulric Juniper",
        "Police Officer": "Unsworn Officer PD85862 ELFORD, Saffron On behalf of - Sworn Officer PD48908 BELBY, Bexric",
        "Result": (
            f"I identified the plant as Cannabis sativa. The plant was sealed in new drug "
            f"movement bag, tag number {tag}. This bag was handed over to Unsworn Officer "
            "ELFORD who was present during the examination"
        ),
        "Quantity Sub Sampled": None,
        "Other Matters": "Subsamples placed into Security Movement Envelope WW001.",
        "New Bag Numbers": None,
        "Comments": None,
    }


def _bundle_bytes(rows, exceptions=None, tamper=False, rules=True):
    files = {SOURCE_TABLE: json.dumps({"rows": rows}).encode()}
    if rules:
        files.update(
            {name: json.dumps({"corrections": []}).encode() for name in RULE_FILES}
        )
    if exceptions is not None:
        files[EXCEPTIONS] = json.dumps(exceptions).encode()
    manifest = {
        "format": FORMAT,
        "built_at": "2026-11-18T00:00:00+00:00",
        "files": {
            name: {"sha256": _sha256(data), "size": len(data)}
            for name, data in files.items()
        },
    }
    if tamper:
        files[SOURCE_TABLE] += b" "
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        for name, data in files.items():
            archive.writestr(name, data)
    return buffer.getvalue()


def _upload(client, data, name="legacy_import_bundle.zip"):
    handle = io.BytesIO(data)
    handle.name = name
    return client.post(
        reverse("legacy_import_bundle"), {"file": handle}, format="multipart"
    )


@pytest.fixture
def maintainer():
    return User.objects.create_user(
        email="maintainer@dbca.wa.gov.au",
        password="x",
        is_maintainer=True,
        role="botanist",
    )


@pytest.fixture
def maintainer_client(maintainer):
    client = APIClient()
    client.force_authenticate(maintainer)
    return client


@pytest.fixture
def inline_runs(monkeypatch):
    """Run tasks straight away, in the test's transaction, instead of a thread."""
    monkeypatch.setattr(jobs, "launch", jobs.execute)
    monkeypatch.setattr(jobs.transaction, "on_commit", lambda callback: callback())


ROWS = [
    _row(841, "D100", "T45001"),
    _row(842, "D100", "T45002"),
    _row(843, "D200", "T55001"),
]


class TestAccess:
    @pytest.mark.parametrize("flags", [{}, {"is_staff": True, "is_superuser": True}])
    def test_non_maintainers_are_refused_even_superusers(self, flags):
        user = User.objects.create_user(
            email="admin@dbca.wa.gov.au", password="x", **flags
        )
        client = APIClient()
        client.force_authenticate(user)
        for name in ("legacy_import_bundle", "legacy_import_runs"):
            assert client.get(reverse(name)).status_code == 403
        assert (
            client.post(reverse("legacy_import_runs"), {"action": "undo"}).status_code
            == 403
        )

    def test_anonymous_is_refused(self):
        assert APIClient().get(reverse("legacy_import_runs")).status_code in (401, 403)

    def test_whoami_reports_the_flag_and_users_cannot_set_it(
        self, maintainer_client, maintainer
    ):
        assert (
            maintainer_client.get("/api/v1/users/whoami").data["is_maintainer"] is True
        )
        other = User.objects.create_user(email="o@dbca.wa.gov.au", password="x")
        admin = User.objects.create_user(
            email="a@dbca.wa.gov.au", password="x", is_staff=True, is_superuser=True
        )
        client = APIClient()
        client.force_authenticate(admin)
        client.patch(
            f"/api/v1/users/{other.pk}", {"is_maintainer": True}, format="json"
        )
        other.refresh_from_db()
        assert other.is_maintainer is False


class TestBundle:
    def test_upload_stores_details_never_the_content(self, maintainer_client):
        response = _upload(maintainer_client, _bundle_bytes(ROWS))
        assert response.status_code == 201
        body = response.data["bundle"]
        assert body["summary"]["source_rows"] == 3
        assert "content" not in body
        assert LegacyImportBundle.objects.count() == 1

    def test_a_new_upload_replaces_the_old(self, maintainer_client):
        _upload(maintainer_client, _bundle_bytes(ROWS))
        _upload(maintainer_client, _bundle_bytes(ROWS[:2]))
        assert LegacyImportBundle.objects.get().summary["source_rows"] == 2

    @pytest.mark.parametrize(
        "data, message",
        [
            (b"not a zip", "not a zip"),
            (_bundle_bytes(ROWS, tamper=True), "checksum"),
            (_bundle_bytes([{"Certificate Number": 1}]), "lacks columns"),
            (_bundle_bytes([ROWS[0], ROWS[0]]), "not unique"),
            (_bundle_bytes(ROWS, rules=False), "missing rules/"),
        ],
    )
    def test_bad_files_are_refused(self, maintainer_client, data, message):
        response = _upload(maintainer_client, data)
        assert response.status_code == 400
        assert message in str(response.data)
        assert not LegacyImportBundle.objects.exists()

    def test_delete(self, maintainer_client):
        _upload(maintainer_client, _bundle_bytes(ROWS))
        assert (
            maintainer_client.delete(reverse("legacy_import_bundle")).status_code == 204
        )
        assert not LegacyImportBundle.objects.exists()


class TestRuns:
    def _start(self, client, action):
        response = client.post(
            reverse("legacy_import_runs"), {"action": action}, format="json"
        )
        return response, LegacyImportRun.objects.order_by("-pk").first()

    def test_needs_a_bundle(self, maintainer_client):
        response, _ = self._start(maintainer_client, "dry_run")
        assert response.status_code == 400
        assert "Upload" in str(response.data)

    def test_dry_run_saves_nothing(self, maintainer_client, inline_runs):
        _upload(maintainer_client, _bundle_bytes(ROWS))
        response, run = self._start(maintainer_client, "dry_run")
        assert response.status_code == 201
        run.refresh_from_db()
        assert run.status == "succeeded", run.error
        assert run.summary["counts"]["cases"] == 2
        assert not Case.all_objects.exists()

    def test_import_then_reconcile_then_undo(self, maintainer_client, inline_runs):
        _upload(maintainer_client, _bundle_bytes(ROWS, exceptions=[]))
        _, run = self._start(maintainer_client, "import")
        run.refresh_from_db()
        assert run.status == "succeeded", (run.error, run.summary)
        assert run.summary["counts"]["cases"] == 2
        assert run.summary["reconcile"]["unexplained"] == 0
        assert LegacySourceRecord.objects.count() == 3

        _, check = self._start(maintainer_client, "reconcile")
        check.refresh_from_db()
        assert check.status == "succeeded"
        detail = maintainer_client.get(
            reverse("legacy_import_run", kwargs={"pk": check.pk})
        )
        assert detail.data["run"]["report"]["reconcile"]["unexplained"] == []

        _, undo = self._start(maintainer_client, "undo")
        undo.refresh_from_db()
        assert undo.summary["removed"]["cases"] == 2
        assert not Case.all_objects.filter(is_legacy=True).exists()

    def test_only_one_run_at_a_time(self, maintainer_client, maintainer):
        _upload(maintainer_client, _bundle_bytes(ROWS))
        LegacyImportRun.objects.create(action="import", started_by=maintainer)
        response, _ = self._start(maintainer_client, "dry_run")
        assert response.status_code == 400
        assert "already running" in str(response.data)

    def test_unknown_action_is_refused(self, maintainer_client):
        response, _ = self._start(maintainer_client, "drop_everything")
        assert response.status_code == 400

    def test_refused_in_practice_mode(self, maintainer_client, maintainer):
        prefs = maintainer.get_preferences
        prefs.practice_mode = True
        prefs.save()
        response, _ = self._start(maintainer_client, "undo")
        assert response.status_code == 403
