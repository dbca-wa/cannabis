"""Signature service — upload, retrieval, deletion, and audit logic."""

import hashlib

from django.core.exceptions import ValidationError as DjangoValidationError
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ..models import Signature, SignatureAuditLog
from ..validators import validate_signature_file


class SignatureService:
    """Business logic for signature operations."""

    @staticmethod
    def get_signature(user):
        """Retrieve a signature for the given user.

        Args:
            user: The User instance whose signature to retrieve.

        Returns:
            The Signature instance.

        Raises:
            NotFound: If no signature exists for this user.
        """
        try:
            return Signature.objects.get(user=user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

    @staticmethod
    def get_signature_by_user_id(user_id):
        """Retrieve a signature by user ID (for staff access).

        Args:
            user_id: The PK of the user whose signature to retrieve.

        Returns:
            The Signature instance.

        Raises:
            NotFound: If no signature exists for this user.
        """
        try:
            return Signature.objects.get(user_id=user_id)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

    @staticmethod
    def upload_signature(user, file):
        """Upload or replace a user's signature.

        Validates the file, computes metadata (hash, dimensions),
        creates or updates the Signature record, and logs the action.

        Args:
            user: The User instance uploading the signature.
            file: The uploaded file (from request.FILES).

        Returns:
            A tuple of (signature, is_update) where signature is the
            Signature instance and is_update indicates replacement.

        Raises:
            PermissionDenied: If user lacks the botanist role.
            ValidationError: If no file provided or file fails validation.
        """
        if user.role != "botanist" and not user.is_superuser:
            raise PermissionDenied("Only Approved Botanists can manage signatures.")

        if not file:
            raise ValidationError({"image": ["No file was submitted."]})

        try:
            validate_signature_file(file)
        except DjangoValidationError as exc:
            raise ValidationError({"image": exc.messages})

        file_hash = SignatureService._compute_file_hash(file)
        content_type = file.content_type
        file_size = file.size
        width = None
        height = None

        if content_type == "image/png":
            width, height = SignatureService._extract_png_dimensions(file)

        existing = Signature.objects.filter(user=user).first()
        is_update = existing is not None

        if is_update:
            existing.image.delete(save=False)
            existing.image = file
            existing.content_type = content_type
            existing.file_size = file_size
            existing.width = width
            existing.height = height
            existing.file_hash = file_hash
            existing.save()
            signature = existing
        else:
            signature = Signature.objects.create(
                user=user,
                image=file,
                content_type=content_type,
                file_size=file_size,
                width=width,
                height=height,
                file_hash=file_hash,
            )

        SignatureAuditLog.objects.create(
            user=user,
            actor=user,
            action="update" if is_update else "upload",
            content_type=content_type,
            file_size=file_size,
            file_hash=file_hash,
        )

        return signature, is_update

    @staticmethod
    def delete_signature(user):
        """Delete a user's signature and its backing file.

        Logs the deletion in the audit trail before removing the record.

        Args:
            user: The User instance whose signature to delete.

        Raises:
            PermissionDenied: If user lacks the botanist role.
            NotFound: If no signature exists for this user.
        """
        if user.role != "botanist" and not user.is_superuser:
            raise PermissionDenied("Only Approved Botanists can manage signatures.")

        try:
            signature = Signature.objects.get(user=user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        SignatureAuditLog.objects.create(
            user=user,
            actor=user,
            action="delete",
            content_type=signature.content_type,
            file_size=signature.file_size,
            file_hash=signature.file_hash,
        )

        signature.image.delete(save=False)
        signature.delete()

    @staticmethod
    def get_signature_image(user):
        """Retrieve the raw image bytes and content type for a user's signature.

        Args:
            user: The User instance whose signature image to serve.

        Returns:
            A tuple of (image_bytes, content_type).

        Raises:
            NotFound: If no signature exists for this user.
        """
        try:
            signature = Signature.objects.get(user=user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        image_data = signature.image.read()
        return image_data, signature.content_type

    @staticmethod
    def get_signature_image_by_user_id(user_id):
        """Retrieve raw image bytes and content type by user ID (staff access).

        Args:
            user_id: The PK of the user whose signature image to serve.

        Returns:
            A tuple of (image_bytes, content_type).

        Raises:
            NotFound: If no signature exists for this user.
        """
        try:
            signature = Signature.objects.get(user_id=user_id)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        image_data = signature.image.read()
        return image_data, signature.content_type

    @staticmethod
    def get_audit_log(user):
        """Retrieve audit log entries for a user's signature.

        Args:
            user: The User instance whose audit log to retrieve.

        Returns:
            A QuerySet of SignatureAuditLog entries ordered by timestamp desc.
        """
        return SignatureAuditLog.objects.filter(user=user)

    @staticmethod
    def get_audit_log_by_user_id(user_id):
        """Retrieve audit log entries by user ID (staff access).

        Args:
            user_id: The PK of the user whose audit log to retrieve.

        Returns:
            A QuerySet of SignatureAuditLog entries ordered by timestamp desc.
        """
        return SignatureAuditLog.objects.filter(user_id=user_id)

    @staticmethod
    def verify_integrity(user):
        """Verify the integrity of a user's signature file.

        Recomputes the SHA-256 hash of the stored file and compares
        it against the stored hash value.

        Args:
            user: The User instance whose signature to verify.

        Returns:
            True if the file hash matches the stored hash.

        Raises:
            NotFound: If no signature exists for this user.
            ValidationError: If the file hash does not match (corruption).
        """
        try:
            signature = Signature.objects.get(user=user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        current_hash = SignatureService._compute_file_hash(signature.image)

        if current_hash != signature.file_hash:
            SignatureAuditLog.objects.create(
                user=user,
                actor=None,
                action="integrity_failure",
                content_type=signature.content_type,
                file_size=signature.file_size,
                file_hash=current_hash,
            )
            raise ValidationError("Signature file integrity check failed.")

        return True

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_file_hash(file):
        """Compute the SHA-256 hex digest of a file's contents."""
        file.seek(0)
        sha256 = hashlib.sha256()
        for chunk in file.chunks():
            sha256.update(chunk)
        file.seek(0)
        return sha256.hexdigest()

    @staticmethod
    def _extract_png_dimensions(file):
        """Extract width and height from a PNG file using Pillow."""
        file.seek(0)
        try:
            img = Image.open(file)
            width, height = img.size
        finally:
            file.seek(0)
        return width, height
