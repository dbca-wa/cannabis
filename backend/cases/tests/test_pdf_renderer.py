"""Tests for the PDF service (PrinceXML-based)."""

from unittest.mock import Mock, patch

import pytest

from cases.services.pdf_service import PDFService


@pytest.mark.django_db
class TestRenderPdf:
    """Verify PrinceXML renderer converts HTML templates to valid PDF bytes."""

    @patch("cases.services.pdf_service.subprocess.run")
    def test_html_to_pdf_produces_valid_pdf_bytes(self, mock_subprocess):
        """_html_to_pdf converts HTML string to bytes via PrinceXML subprocess."""
        html_content = "<html><body><h1>Hello PrinceXML</h1></body></html>"
        mock_subprocess.return_value = Mock(returncode=0, stderr="")

        with patch("builtins.open", create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                b"%PDF-1.4 fake pdf content"
            )
            result = PDFService._html_to_pdf(html_content)

        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b"%PDF-", "Output should start with PDF magic bytes"
        mock_subprocess.assert_called_once()
        # Verify prince binary was invoked
        call_args = mock_subprocess.call_args[0][0]
        assert "prince" in call_args

    @patch("cases.services.pdf_service.subprocess.run")
    def test_html_to_pdf_calls_prince_with_correct_args(self, mock_subprocess):
        """_html_to_pdf writes HTML to a temp file and invokes prince with it."""
        mock_subprocess.return_value = Mock(returncode=0, stderr="")

        with patch("builtins.open", create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                b"%PDF-1.4 fake"
            )
            PDFService._html_to_pdf("<html><body>Test</body></html>")

        # Verify subprocess was called with prince, input html path, -o, output path
        call_args = mock_subprocess.call_args
        cmd = call_args[0][0]
        assert cmd[0] == "prince"
        assert cmd[2] == "-o"
        assert call_args[1]["timeout"] == 300

    @patch("cases.services.pdf_service.subprocess.run")
    def test_html_to_pdf_raises_on_prince_failure(self, mock_subprocess):
        """_html_to_pdf raises ValidationError when PrinceXML returns non-zero."""
        from rest_framework.exceptions import ValidationError

        mock_subprocess.return_value = Mock(returncode=1, stderr="Prince error")

        with pytest.raises(ValidationError, match="PDF generation failed"):
            PDFService._html_to_pdf("<html><body>Test</body></html>")

    @patch("cases.services.pdf_service.subprocess.run")
    def test_html_to_pdf_raises_on_timeout(self, mock_subprocess):
        """_html_to_pdf raises ValidationError on subprocess timeout."""
        from subprocess import TimeoutExpired

        from rest_framework.exceptions import ValidationError

        mock_subprocess.side_effect = TimeoutExpired("prince", 300)

        with pytest.raises(ValidationError, match="timed out"):
            PDFService._html_to_pdf("<html><body>Test</body></html>")

    @patch("cases.services.pdf_service.subprocess.run")
    def test_html_to_pdf_raises_on_missing_binary(self, mock_subprocess):
        """_html_to_pdf raises ValidationError when prince binary not found."""
        from rest_framework.exceptions import ValidationError

        mock_subprocess.side_effect = FileNotFoundError(
            "[Errno 2] No such file or directory: 'prince'"
        )

        with pytest.raises(ValidationError, match="unavailable"):
            PDFService._html_to_pdf("<html><body>Test</body></html>")
