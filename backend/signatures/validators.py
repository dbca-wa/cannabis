from django.core.exceptions import ValidationError
from PIL import Image

# PNG files start with this 8-byte magic sequence
PNG_MAGIC_BYTES = b"\x89PNG\r\n\x1a\n"

# Maximum file size: 2 MB
MAX_FILE_SIZE = 2 * 1024 * 1024

# Maximum image dimensions for PNG files
MAX_WIDTH = 800
MAX_HEIGHT = 400

ALLOWED_CONTENT_TYPES = {"image/png", "image/svg+xml"}


def validate_signature_file(file) -> None:
    """Validate an uploaded signature image file.

    Checks content type, file size, image dimensions (PNG only),
    and verifies file content matches the declared content type
    via magic bytes.

    Raises django.core.exceptions.ValidationError on failure.
    """
    content_type = file.content_type

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("Only PNG and SVG files are accepted.")

    if file.size > MAX_FILE_SIZE:
        raise ValidationError("File size must not exceed 2 MB.")

    # Read the first bytes to verify magic bytes match declared type
    file.seek(0)
    header = file.read(16)
    file.seek(0)

    if content_type == "image/png":
        if not header.startswith(PNG_MAGIC_BYTES):
            raise ValidationError("Only PNG and SVG files are accepted.")

        # Check dimensions using Pillow
        try:
            img = Image.open(file)
            width, height = img.size
        except Exception:
            raise ValidationError("Only PNG and SVG files are accepted.")
        finally:
            file.seek(0)

        if width > MAX_WIDTH or height > MAX_HEIGHT:
            raise ValidationError(
                "Image dimensions must not exceed 800\u00d7400 pixels."
            )

    elif content_type == "image/svg+xml":
        # SVG files should start with '<?xml' or '<svg' (or whitespace before)
        try:
            text = header.decode("utf-8").lstrip()
        except UnicodeDecodeError:
            raise ValidationError("Only PNG and SVG files are accepted.")

        if not (text.startswith("<?xml") or text.startswith("<svg")):
            raise ValidationError("Only PNG and SVG files are accepted.")
