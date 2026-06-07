"""Shared fixtures for signatures tests."""

import hashlib

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from signatures.models import Signature, SignatureAuditLog

User = get_user_model()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return User.objects.create_user(
        email="staff_sig@test.com",
        password="testpass123",
        first_name="Staff",
        last_name="Sig",
        is_staff=True,
    )


@pytest.fixture
def botanist_sig_user(db):
    """Create a botanist user for signature tests."""
    return User.objects.create_user(
        email="botanist_sig@test.com",
        password="testpass123",
        first_name="Botanist",
        last_name="Sig",
        role="botanist",
    )


@pytest.fixture
def signature(db, botanist_sig_user):
    """Create a Signature for the botanist user with a mock PNG image."""
    from io import BytesIO

    from PIL import Image

    # Create a simple 100x50 transparent PNG
    image = Image.new("RGBA", (100, 50), (0, 0, 0, 0))
    image_io = BytesIO()
    image.save(image_io, format="PNG")
    image_bytes = image_io.getvalue()

    file_hash = hashlib.sha256(image_bytes).hexdigest()

    uploaded_file = SimpleUploadedFile(
        "signature.png", image_bytes, content_type="image/png"
    )

    return Signature.objects.create(
        user=botanist_sig_user,
        image=uploaded_file,
        content_type="image/png",
        file_size=len(image_bytes),
        width=100,
        height=50,
        file_hash=file_hash,
    )


@pytest.fixture
def audit_log_entry(db, botanist_sig_user):
    """Create a SignatureAuditLog entry."""
    return SignatureAuditLog.objects.create(
        user=botanist_sig_user,
        actor=botanist_sig_user,
        action="upload",
        content_type="image/png",
        file_size=1024,
        file_hash="abc123def456",
    )
