"""PDF service — consolidated PrinceXML PDF generation.

All PDF rendering in the application flows through PDFService._html_to_pdf,
which manages temp files, subprocess invocation, timeout, and cleanup.
"""

import os
import subprocess
import tempfile

from django.conf import settings
from rest_framework.exceptions import ValidationError


class PDFService:
    """PDF generation service using PrinceXML."""

    @staticmethod
    def _html_to_pdf(html_content: str, extra_args: list[str] | None = None) -> bytes:
        """Convert an HTML string to PDF bytes via PrinceXML subprocess.

        Creates temporary files for input/output, invokes the prince binary
        with a 300-second timeout, and cleans up regardless of outcome.

        Args:
            html_content: Rendered HTML string to convert.
            extra_args: Optional additional PrinceXML CLI arguments
                (e.g. ['--style=path.css', '--javascript']).

        Returns:
            Raw PDF bytes.

        Raises:
            ValidationError: On non-zero exit code, timeout, or missing binary.
        """
        html_path = None
        pdf_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".html", delete=False, encoding="utf-8"
            ) as html_file:
                html_file.write(html_content)
                html_path = html_file.name

            pdf_path = html_path.replace(".html", ".pdf")

            cmd = ["prince", html_path, "-o", pdf_path]
            if extra_args:
                cmd.extend(extra_args)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode != 0:
                settings.LOGGER.error(f"PrinceXML failed: {result.stderr}")
                raise ValidationError("PDF generation failed. Please try again.")

            with open(pdf_path, "rb") as f:
                return f.read()

        except subprocess.TimeoutExpired:
            settings.LOGGER.error("PrinceXML timed out after 300 seconds")
            raise ValidationError("PDF generation timed out.")
        except FileNotFoundError:
            settings.LOGGER.error("PrinceXML binary not found in PATH")
            raise ValidationError("PrinceXML is unavailable.")
        except ValidationError:
            raise
        except Exception as e:
            settings.LOGGER.error(f"PDF generation error: {e}")
            raise ValidationError("PDF generation failed. Please try again.")
        finally:
            if html_path and os.path.exists(html_path):
                os.unlink(html_path)
            if pdf_path and os.path.exists(pdf_path):
                os.unlink(pdf_path)
