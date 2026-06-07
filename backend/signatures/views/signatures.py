"""Views for signature CRUD operations and image serving."""

import hashlib

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
)
from rest_framework.views import APIView

from ..models import Signature, SignatureAuditLog
from ..serializers import SignatureSerializer
from ..validators import validate_signature_file


def _compute_file_hash(file):
    """Compute the SHA-256 hex digest of a file's contents."""
    file.seek(0)
    sha256 = hashlib.sha256()
    for chunk in file.chunks():
        sha256.update(chunk)
    file.seek(0)
    return sha256.hexdigest()


def _extract_png_dimensions(file):
    """Extract width and height from a PNG file using Pillow."""
    file.seek(0)
    try:
        img = Image.open(file)
        width, height = img.size
    finally:
        file.seek(0)
    return width, height


class MySignatureView(APIView):
    """Manage the current user's signature.

    GET  — retrieve signature metadata
    POST — upload or replace a signature (multipart/form-data, field: "image")
    DELETE — delete the signature
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return the current user's signature metadata."""
        try:
            signature = Signature.objects.get(user=request.user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        serializer = SignatureSerializer(signature, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)

    def post(self, request):
        """Upload or replace the current user's signature."""
        if request.user.role != "botanist" and not request.user.is_superuser:
            raise PermissionDenied("Only Approved Botanists can manage signatures.")

        file = request.FILES.get("image")
        if not file:
            raise ValidationError({"image": ["No file was submitted."]})

        try:
            validate_signature_file(file)
        except DjangoValidationError as exc:
            raise ValidationError({"image": exc.messages})

        file_hash = _compute_file_hash(file)
        content_type = file.content_type
        file_size = file.size
        width = None
        height = None

        if content_type == "image/png":
            width, height = _extract_png_dimensions(file)

        existing = Signature.objects.filter(user=request.user).first()
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
                user=request.user,
                image=file,
                content_type=content_type,
                file_size=file_size,
                width=width,
                height=height,
                file_hash=file_hash,
            )

        SignatureAuditLog.objects.create(
            user=request.user,
            actor=request.user,
            action="update" if is_update else "upload",
            content_type=content_type,
            file_size=file_size,
            file_hash=file_hash,
        )

        serializer = SignatureSerializer(signature, context={"request": request})
        status_code = HTTP_200_OK if is_update else HTTP_201_CREATED
        return Response(serializer.data, status=status_code)

    def delete(self, request):
        """Delete the current user's signature and its backing file."""
        if request.user.role != "botanist" and not request.user.is_superuser:
            raise PermissionDenied("Only Approved Botanists can manage signatures.")

        try:
            signature = Signature.objects.get(user=request.user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        SignatureAuditLog.objects.create(
            user=request.user,
            actor=request.user,
            action="delete",
            content_type=signature.content_type,
            file_size=signature.file_size,
            file_hash=signature.file_hash,
        )

        signature.image.delete(save=False)
        signature.delete()

        return Response(status=HTTP_204_NO_CONTENT)


class MySignatureImageView(APIView):
    """Serve the current user's signature image file."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return the raw image bytes with the correct Content-Type."""
        try:
            signature = Signature.objects.get(user=request.user)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        image_data = signature.image.read()
        return HttpResponse(image_data, content_type=signature.content_type)


class UserSignatureView(APIView):
    """Retrieve another user's signature metadata (staff only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        """Return signature metadata for the given user."""
        if not request.user.is_staff:
            raise PermissionDenied(
                "You do not have permission to access this signature."
            )

        try:
            signature = Signature.objects.get(user_id=user_id)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        serializer = SignatureSerializer(signature, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)


class UserSignatureImageView(APIView):
    """Serve another user's signature image file (staff only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        """Return the raw image bytes for the given user's signature."""
        if not request.user.is_staff:
            raise PermissionDenied(
                "You do not have permission to access this signature."
            )

        try:
            signature = Signature.objects.get(user_id=user_id)
        except Signature.DoesNotExist:
            raise NotFound("No signature on file.")

        image_data = signature.image.read()
        return HttpResponse(image_data, content_type=signature.content_type)
