"""Tesseract OCR client wrapper for local document processing."""

import io
import logging

import pytesseract
from django.conf import settings
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

# Use configured binary path if available
if hasattr(settings, "TESSERACT_CMD") and settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

# Render PDFs at 400 DPI for better small-text recognition
PDF_DPI = 400


def _images_from_bytes(file_bytes: bytes, content_type: str) -> list[Image.Image]:
    """Convert uploaded file bytes into PIL Image objects.

    PDFs are split into one image per page using pdf2image.
    Image files (PNG, JPEG, TIFF) are opened directly.
    """
    if content_type == "application/pdf":
        from pdf2image import convert_from_bytes

        return convert_from_bytes(file_bytes, dpi=PDF_DPI)

    return [Image.open(io.BytesIO(file_bytes))]


def _preprocess(img: Image.Image) -> Image.Image:
    """Prepare an image for OCR by removing highlighting and
    boosting contrast.

    Steps:
      1. Convert to greyscale — strips yellow/green highlighting
         so the underlying text becomes visible.
      2. Boost contrast — makes faint text sharper against the
         background.
      3. Sharpen — improves edge definition for character
         recognition.
    """
    grey = img.convert("L")
    enhanced = ImageEnhance.Contrast(grey).enhance(1.8)
    sharpened = enhanced.filter(ImageFilter.SHARPEN)
    return sharpened


class TesseractOcrClient:
    """Runs Tesseract OCR locally — no data leaves the server."""

    def extract_text(self, file_bytes: bytes, content_type: str) -> str:
        """Run OCR on the uploaded file and return the full text.

        Images are pre-processed (greyscale + contrast + sharpen) to
        strip highlighting and improve recognition. For multi-page PDFs,
        text from all pages is concatenated with newlines.
        """
        images = _images_from_bytes(file_bytes, content_type)
        pages = []
        for i, img in enumerate(images):
            processed = _preprocess(img)
            text = pytesseract.image_to_string(processed, lang="eng")
            pages.append(text)
            logger.debug("OCR page %d: extracted %d characters", i + 1, len(text))
        return "\n".join(pages)

    def extract_with_confidence(
        self, file_bytes: bytes, content_type: str
    ) -> list[dict]:
        """Run OCR and return per-word results with confidence scores.

        Each entry contains 'text' (the recognised word) and 'conf'
        (Tesseract's confidence 0–100). Words with conf < 0 are
        filtered out as they represent whitespace/noise.
        """
        images = _images_from_bytes(file_bytes, content_type)
        all_words: list[dict] = []

        for img in images:
            processed = _preprocess(img)
            data = pytesseract.image_to_data(
                processed, lang="eng", output_type=pytesseract.Output.DICT
            )
            for j in range(len(data["text"])):
                conf = int(data["conf"][j])
                word = data["text"][j].strip()
                if word and conf >= 0:
                    all_words.append({"text": word, "conf": conf})

        return all_words
