from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/users/", include("users.urls")),
    path("api/v1/police/", include("police.urls")),
    path('api/communications/', include('communications.urls')),
    path('api/submissions/', include('submissions.urls')),  
    re_path(r"^files/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
] + static(
    settings.MEDIA_URL,
    document_root=settings.MEDIA_ROOT,
)
