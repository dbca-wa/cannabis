"""Preview views — DEBUG-only HTML preview of PDF templates.

These endpoints render the certificate template as raw HTML in the browser,
allowing developers to verify template output without generating actual PDFs.
"""

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from users.permissions import HasAppAccess

from ..models import Case, Certificate
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

        case = get_object_or_404(Case, pk=pk)

        certificate = (
            Certificate.objects.filter(form__case=case)
            .select_related("form", "form__case")
            .first()
        )
        if certificate is None:
            return HttpResponse(
                "<p>No certificate is available to preview for this case yet.</p>",
                content_type="text/html",
            )

        context = build_certificate_context(certificate)
        html = render_to_string("pdf/certificate_template.html", context)
        return HttpResponse(html, content_type="text/html")
