import base64
import os
from django.conf import settings


def get_encoded_media(filename, media_type="image/jpeg"):
    """
    Generic function to encode media files as base64 strings for email embedding.

    Args:
        filename: Name of the file (e.g., 'dbca.jpg', 'cannabis.svg')
        media_type: MIME type (e.g., 'image/jpeg', 'image/svg+xml', 'image/png')

    Returns:
        Base64 encoded data URL string, or empty string if file not found
    """
    # Get file extension
    file_ext = os.path.splitext(filename)[1].lower()

    # List of possible paths to try
    possible_paths = [
        os.path.join(settings.BASE_DIR, "documents", filename),
        os.path.join(settings.BASE_DIR, "documents", "static", filename),
        os.path.join(settings.BASE_DIR, "staticfiles", "images", filename),
        os.path.join(settings.BASE_DIR, filename),
        os.path.join(settings.MEDIA_ROOT, filename),
        # Same folder as this utils file
        os.path.join(os.path.dirname(__file__), filename),
    ]

    for file_path in possible_paths:
        try:
            settings.LOGGER.info(f"Trying {filename} path: {file_path}")

            if os.path.exists(file_path):
                settings.LOGGER.info(f"Found {filename} at: {file_path}")

                with open(file_path, "rb") as media_file:
                    encoded_media = base64.b64encode(media_file.read()).decode("utf-8")

                    # Validate the encoded media
                    if len(encoded_media) > 0:
                        data_url = f"data:{media_type};base64,{encoded_media}"
                        settings.LOGGER.info(
                            f"Successfully encoded {filename} from {file_path} (size: {len(data_url)} chars)"
                        )
                        return data_url
                    else:
                        settings.LOGGER.warning(
                            f"Encoded {filename} from {file_path} is empty"
                        )
                        continue  # Try next path
            else:
                settings.LOGGER.info(f"{filename} not found at: {file_path}")

        except Exception as e:
            settings.LOGGER.error(f"Error processing {filename} at {file_path}: {e}")
            continue  # Try next path

    # If we get here, no file was found at any location
    settings.LOGGER.error(
        f"Could not find {filename} at any of the expected locations:"
    )
    for path in possible_paths:
        settings.LOGGER.error(f"  - {path}")

    return ""


def get_encoded_image():
    """
    Encodes the DBCA logo image as a base64 string for email embedding.
    """
    return get_encoded_media("dbca.jpg", "image/jpeg")


def get_cannabis_svg():
    """
    Encodes the cannabis SVG as a base64 string for email embedding.
    """
    return get_encoded_media("cannabis.svg", "image/svg+xml")


def get_encoded_png(filename):
    """
    Encodes a PNG image as a base64 string for email embedding.
    """
    return get_encoded_media(filename, "image/png")
