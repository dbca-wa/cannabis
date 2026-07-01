from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case
from ..services.ocr_service import ServiceUnavailable  # noqa: F401

ALLOWED_OCR_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
}
MAX_OCR_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


class OcrUploadView(APIView):
    """Accept a scanned police form and return extracted data.

    Runs Tesseract OCR locally, parses the text for structured fields,
    and matches extracted entities against existing database records.
    """

    permission_classes = [HasAppAccess]
    parser_classes = [MultiPartParser]

    def post(self, request):
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

        from ..services.ocr_service import OcrService

        result = OcrService.process_upload(file.read(), file.content_type)
        return Response(result, status=HTTP_200_OK)


class PoliceFormUploadView(APIView):
    """Attach (or replace) the scanned Priority 3 form on a case.

    The form is optional and stored for reference (Azure Blob in production).
    Used after case creation and on the process-case details phase. Complete
    cases are read-only for non-admins.
    """

    permission_classes = [HasAppAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            case = Case.objects.get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        from ..permissions import ensure_case_editable
        from ..serializers import CaseSerializer

        ensure_case_editable(case, request.user)

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

        case.police_form = file
        case.save(update_fields=["police_form", "updated_at"])

        return Response(
            {"police_form_url": CaseSerializer(case).data["police_form_url"]},
            status=HTTP_200_OK,
        )
