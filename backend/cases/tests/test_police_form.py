"""Tests for the optional Priority 3 police-form storage endpoint."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from common.tests.factories import CaseFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _media_root(settings, tmp_path):
    """Write uploaded files to a temp dir, not the real media store."""
    settings.MEDIA_ROOT = str(tmp_path)


def _pdf(name="form.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


class TestPoliceFormUpload:
    def test_uploads_and_stores_form(self, finance_client):
        case = CaseFactory()
        resp = finance_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {"file": _pdf()},
            format="multipart",
        )
        assert resp.status_code == 200
        assert resp.data["police_form_url"]
        case.refresh_from_db()
        assert bool(case.police_form)

    def test_rejects_unsupported_type(self, finance_client):
        case = CaseFactory()
        bad = SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")
        resp = finance_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {"file": bad},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_requires_file(self, finance_client):
        case = CaseFactory()
        resp = finance_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_requires_app_access(self, roleless_client):
        case = CaseFactory()
        resp = roleless_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {"file": _pdf()},
            format="multipart",
        )
        assert resp.status_code == 403

    def test_complete_case_blocks_non_admin(self, finance_client):
        case = CaseFactory(phase="complete")
        resp = finance_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {"file": _pdf()},
            format="multipart",
        )
        assert resp.status_code == 403

    def test_complete_case_allowed_for_admin(self, admin_client):
        case = CaseFactory(phase="complete")
        resp = admin_client.post(
            reverse("police_form_upload", kwargs={"pk": case.pk}),
            {"file": _pdf()},
            format="multipart",
        )
        assert resp.status_code == 200
