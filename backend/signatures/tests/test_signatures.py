"""Tests for signature and audit log endpoints."""

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

User = get_user_model()


@pytest.mark.django_db
def test_get_own_signature(api_client, botanist_sig_user, signature):
    """GET me returns 200 with signature data when signature exists."""
    api_client.force_authenticate(user=botanist_sig_user)
    url = reverse("my_signature")
    response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["content_type"] == "image/png"
    assert response.data["file_size"] == signature.file_size


@pytest.mark.django_db
def test_upload_signature(api_client, db):
    """POST me with mock PNG creates a signature."""
    botanist = User.objects.create_user(
        email="upload_botanist@test.com",
        password="testpass123",
        first_name="Upload",
        last_name="Botanist",
        role="botanist",
    )
    api_client.force_authenticate(user=botanist)

    # Create a valid PNG image
    image = Image.new("RGBA", (100, 50), (0, 0, 0, 0))
    image_io = BytesIO()
    image.save(image_io, format="PNG")
    image_io.seek(0)

    uploaded_file = SimpleUploadedFile(
        "new_signature.png", image_io.read(), content_type="image/png"
    )

    url = reverse("my_signature")
    response = api_client.post(url, {"image": uploaded_file}, format="multipart")

    assert response.status_code == 201


@pytest.mark.django_db
def test_get_other_user_signature_as_staff(
    api_client, staff_user, botanist_sig_user, signature
):
    """GET <user_id> as staff returns 200."""
    api_client.force_authenticate(user=staff_user)
    url = reverse("user_signature", kwargs={"user_id": botanist_sig_user.pk})
    response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["content_type"] == "image/png"


@pytest.mark.django_db
def test_get_other_user_signature_as_non_staff(
    api_client, botanist_sig_user, signature
):
    """GET <user_id> as regular user returns 403."""
    regular_user = User.objects.create_user(
        email="regular_sig@test.com",
        password="testpass123",
        first_name="Regular",
        last_name="Sig",
        role="none",
    )
    api_client.force_authenticate(user=regular_user)
    url = reverse("user_signature", kwargs={"user_id": botanist_sig_user.pk})
    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_get_own_audit_log(api_client, botanist_sig_user, audit_log_entry):
    """GET audit returns 200 with list of actions."""
    api_client.force_authenticate(user=botanist_sig_user)
    url = reverse("my_audit_log")
    response = api_client.get(url)

    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert len(response.data) >= 1
    assert response.data[0]["action"] == "upload"


@pytest.mark.django_db
def test_get_other_user_audit_log_as_staff(
    api_client, staff_user, botanist_sig_user, audit_log_entry
):
    """GET audit/<user_id> as staff returns 200."""
    api_client.force_authenticate(user=staff_user)
    url = reverse("user_audit_log", kwargs={"user_id": botanist_sig_user.pk})
    response = api_client.get(url)

    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert len(response.data) >= 1
