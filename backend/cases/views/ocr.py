from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

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

    permission_classes = [IsAuthenticated]
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
