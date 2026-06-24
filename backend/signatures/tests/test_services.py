"""Service-layer tests for SignatureService."""

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from signatures.models import Signature, SignatureAuditLog
from signatures.services.signature_service import SignatureService

User = get_user_model()


def _png_file(name="sig.png", size=(200, 100)):
    """Build a valid in-memory PNG upload."""
    buf = io.BytesIO()
    Image.new("RGBA", size, (0, 0, 0, 0)).save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


@pytest.fixture
def botanist(db):
    return User.objects.create_user(
        email="sigbot@test.com",
        password="x",
        first_name="Sig",
        last_name="Bot",
        role="botanist",
    )


@pytest.fixture
def non_botanist(db):
    return User.objects.create_user(
        email="signone@test.com",
        password="x",
        first_name="No",
        last_name="Role",
        role="none",
    )


@pytest.mark.django_db
class TestSignatureUpload:
    def test_upload_success(self, botanist):
        signature, is_update = SignatureService.upload_signature(botanist, _png_file())
        assert signature.pk is not None
        assert is_update is False
        assert signature.width == 200
        assert signature.height == 100

    def test_upload_replace(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        signature, is_update = SignatureService.upload_signature(
            botanist, _png_file(size=(150, 80))
        )
        assert is_update is True
        assert signature.width == 150

    def test_upload_non_botanist_denied(self, non_botanist):
        with pytest.raises(PermissionDenied):
            SignatureService.upload_signature(non_botanist, _png_file())

    def test_upload_no_file(self, botanist):
        with pytest.raises(ValidationError):
            SignatureService.upload_signature(botanist, None)

    def test_upload_invalid_file(self, botanist):
        bad = SimpleUploadedFile("x.txt", b"not a png", content_type="image/png")
        with pytest.raises(ValidationError):
            SignatureService.upload_signature(botanist, bad)

    def test_upload_creates_audit_log(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        assert SignatureAuditLog.objects.filter(user=botanist, action="upload").exists()


@pytest.mark.django_db
class TestSignatureRetrieval:
    def test_get_signature_success(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        result = SignatureService.get_signature(botanist)
        assert result.user_id == botanist.pk

    def test_get_signature_not_found(self, botanist):
        with pytest.raises(NotFound):
            SignatureService.get_signature(botanist)

    def test_get_signature_by_user_id(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        result = SignatureService.get_signature_by_user_id(botanist.pk)
        assert result.user_id == botanist.pk

    def test_get_signature_by_user_id_not_found(self):
        with pytest.raises(NotFound):
            SignatureService.get_signature_by_user_id(999999)

    def test_get_signature_image(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        data, content_type = SignatureService.get_signature_image(botanist)
        assert content_type == "image/png"
        assert len(data) > 0

    def test_get_signature_image_not_found(self, botanist):
        with pytest.raises(NotFound):
            SignatureService.get_signature_image(botanist)

    def test_get_signature_image_by_user_id(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        data, content_type = SignatureService.get_signature_image_by_user_id(
            botanist.pk
        )
        assert content_type == "image/png"

    def test_get_signature_image_by_user_id_not_found(self):
        with pytest.raises(NotFound):
            SignatureService.get_signature_image_by_user_id(999999)


@pytest.mark.django_db
class TestSignatureDelete:
    def test_delete_success(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        SignatureService.delete_signature(botanist)
        assert not Signature.objects.filter(user=botanist).exists()
        assert SignatureAuditLog.objects.filter(user=botanist, action="delete").exists()

    def test_delete_non_botanist_denied(self, non_botanist):
        with pytest.raises(PermissionDenied):
            SignatureService.delete_signature(non_botanist)

    def test_delete_not_found(self, botanist):
        with pytest.raises(NotFound):
            SignatureService.delete_signature(botanist)


@pytest.mark.django_db
class TestSignatureAuditAndIntegrity:
    def test_get_audit_log(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        logs = SignatureService.get_audit_log(botanist)
        assert logs.count() >= 1

    def test_get_audit_log_by_user_id(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        logs = SignatureService.get_audit_log_by_user_id(botanist.pk)
        assert logs.count() >= 1

    def test_verify_integrity_success(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        assert SignatureService.verify_integrity(botanist) is True

    def test_verify_integrity_not_found(self, botanist):
        with pytest.raises(NotFound):
            SignatureService.verify_integrity(botanist)

    def test_verify_integrity_corrupted(self, botanist):
        SignatureService.upload_signature(botanist, _png_file())
        sig = Signature.objects.get(user=botanist)
        sig.file_hash = "deadbeef"
        sig.save()
        with pytest.raises(ValidationError):
            SignatureService.verify_integrity(botanist)
