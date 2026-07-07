"""Form-scoped views — Priority 3 forms within a case.

A case contains one or more Priority 3 forms. Each form owns its scanned image
and its drug bags (at most five) and produces exactly one certificate. Adding a
form works for any case (including a Legacy ETL Case) and leaves the case's
existing data untouched; a form whose certificate is complete is read-only for
non-admin users.
"""

from django.conf import settings
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case, Priority3Form
from ..permissions import ensure_form_editable
from ..serializers import CertificateSerializer, Priority3FormSerializer
from ..services import CertificateService
from .ocr import ALLOWED_OCR_MIME_TYPES, MAX_OCR_FILE_SIZE


class CaseFormListCreateView(ListCreateAPIView):
    """GET: list a case's Priority 3 forms. POST: add a form to the case.

    Adding a form is allowed for any case, including a completed or Legacy ETL
    Case, and never alters the case's existing data.
    """

    permission_classes = [HasAppAccess]
    serializer_class = Priority3FormSerializer
    pagination_class = None

    def _get_case(self):
        try:
            return Case.objects.get(pk=self.kwargs["pk"])
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

    def get_queryset(self):
        return (
            Priority3Form.objects.filter(case_id=self.kwargs["pk"])
            .select_related("case", "certificate")
            .prefetch_related("bags__assessment")
            .order_by("id")
        )

    def perform_create(self, serializer):
        case = self._get_case()
        form = serializer.save(case=case)
        settings.LOGGER.info(
            f"User {self.request.user} added Priority 3 form {form.pk} "
            f"to case {case.case_number}"
        )


class FormDetailView(RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE a single Priority 3 form.

    Updating or deleting a completed form is blocked for non-admins, and a form
    whose certificate has been added to a batch cannot be deleted.
    """

    permission_classes = [HasAppAccess]
    serializer_class = Priority3FormSerializer
    queryset = Priority3Form.objects.select_related(
        "case", "certificate"
    ).prefetch_related("bags__assessment")

    def perform_update(self, serializer):
        ensure_form_editable(serializer.instance, self.request.user)
        form = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated Priority 3 form {form.pk}"
        )

    def perform_destroy(self, instance):
        ensure_form_editable(instance, self.request.user)
        certificate = getattr(instance, "certificate", None)
        if certificate is not None and certificate.batch_id is not None:
            raise ValidationError(
                "This form's certificate is in a batch and cannot be deleted."
            )
        settings.LOGGER.warning(
            f"User {self.request.user} deleted Priority 3 form {instance.pk}"
        )
        super().perform_destroy(instance)


class FormCertificateGenerateView(APIView):
    """POST: generate or regenerate this form's single certificate.

    Delegates to the certificate service, which creates the form's one
    certificate (fresh unique number) or re-renders it in place, and never
    touches any other certificate on the case.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        try:
            form = Priority3Form.objects.select_related("case").get(pk=pk)
        except Priority3Form.DoesNotExist:
            raise NotFound("Priority 3 form not found.")

        ensure_form_editable(form, request.user)

        section_c_note = request.data.get("section_c_note")
        certificate = CertificateService.generate_certificate(
            form, request.user, section_c_note=section_c_note
        )
        serializer = CertificateSerializer(certificate, context={"request": request})
        return Response(serializer.data, status=HTTP_201_CREATED)


class FormScannedImageUploadView(APIView):
    """POST: attach or replace this form's scanned Priority 3 image.

    The image belongs to the form. Accepts the same file types and size limit as
    the OCR upload (PDF, PNG, JPEG, TIFF; 20 MB).
    """

    permission_classes = [HasAppAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            form = Priority3Form.objects.select_related("case").get(pk=pk)
        except Priority3Form.DoesNotExist:
            raise NotFound("Priority 3 form not found.")

        ensure_form_editable(form, request.user)

        file = request.FILES.get("file")
        if not file:
            raise ValidationError({"file": ["No file provided."]})

        if file.content_type not in ALLOWED_OCR_MIME_TYPES:
            raise ValidationError(
                {
                    "file": [
                        f"Unsupported file type '{file.content_type}'. "
                        "Accepted: PDF, PNG, JPEG, TIFF."
                    ]
                }
            )

        if file.size > MAX_OCR_FILE_SIZE:
            raise ValidationError({"file": ["File size exceeds the 20 MB limit."]})

        form.scanned_image = file
        form.save(update_fields=["scanned_image", "updated_at"])

        serializer = Priority3FormSerializer(form, context={"request": request})
        return Response(serializer.data, status=HTTP_200_OK)
