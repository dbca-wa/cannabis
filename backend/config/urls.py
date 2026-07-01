from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve

handler404 = "config.exception_handler.custom_404_handler"
handler500 = "config.exception_handler.custom_500_handler"


def health_check(request):
    """Kubernetes liveness/readiness probe endpoint. Tests DB connectivity."""
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ok"})
    except Exception as e:
        return JsonResponse({"status": "error", "detail": str(e)}, status=503)


urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("admin/", admin.site.urls),
    path("api/v1/users/", include("users.urls")),
    path("api/v1/police/", include("police.urls")),
    path("api/v1/cases/", include("cases.urls")),
    path("api/v1/defendants/", include("defendants.urls")),
    path("api/v1/system/", include("common.urls")),
    re_path(r"^files/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
] + static(
    settings.MEDIA_URL,
    document_root=settings.MEDIA_ROOT,
)

# Preview endpoints for PDF templates (views enforce DEBUG check at request time)
from cases.views.previews import CertificatePreviewView  # noqa: E402

urlpatterns += [
    path(
        "api/v1/test/certificate-preview/<int:pk>",
        CertificatePreviewView.as_view(),
        name="certificate_preview",
    ),
]
