from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path("admin/", admin.site.urls),
    # path("auth/", include("auth.urls")),
    path("api/v1/users/", include("users.urls")),
    path("api/v1/submissions/", include("submissions.urls")),
    path("api/v1/medias/", include("medias.urls")),
    path("api/v1/organisations/", include("organisations.urls")),
    # path("api/v1/adminoptions/", include("adminoptions.urls")),
    re_path(r"^files/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
] + static(
    settings.MEDIA_URL,
    document_root=settings.MEDIA_ROOT,
)
