"""Preview views — DEBUG-only HTML preview of PDF templates.

These endpoints render the certificate template as raw HTML in the browser,
allowing developers to verify template output without generating actual PDFs.
"""

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case
from ..services.certificate_service import build_certificate_context


class CertificatePreviewView(APIView):
    """Render the certificate template as HTML for browser preview.

    DEBUG-only endpoint — returns 403 in non-debug environments.
    Uses real case data to populate the template context.
    """

    permission_classes = [HasAppAccess]

    def get(self, request, pk):
        if not settings.DEBUG:
            raise PermissionDenied(
                "Preview endpoints are only available in DEBUG mode."
            )

        submission = get_object_or_404(Case, pk=pk)

        certificate = submission.certificates.first()
        if certificate is None:
            certificate = _MockCertificate(
                certificate_number="PREVIEW-0000",
                certified_date=timezone.now().date(),
            )

        context = build_certificate_context(submission, certificate)
        html = render_to_string("pdf/certificate_template.html", context)
        return HttpResponse(html, content_type="text/html")


class _MockCertificate:
    """Lightweight stand-in for a Certificate when none exists yet."""

    def __init__(self, certificate_number, certified_date=None):
        self.certificate_number = certificate_number
        self.certified_date = certified_date

    class _EmptyBags:
        def select_related(self, *args, **kwargs):
            return self

        def all(self):
            return []

    @property
    def bags(self):
        return self._EmptyBags()
