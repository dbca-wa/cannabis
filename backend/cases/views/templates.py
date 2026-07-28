"""Views for Section C note templates CRUD."""

import logging

from django.conf import settings
from django.db.models import Q
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from users.permissions import HasAppAccess

from ..models import SectionCTemplate
from ..serializers.templates import (
    SectionCTemplateCreateSerializer,
    SectionCTemplateSerializer,
)

logger = logging.getLogger(__name__)


class SectionCTemplateListView(ListCreateAPIView):
    """
    GET: List all Section C templates (with optional ?search= filtering).
    POST: Create a new template.
    """

    queryset = SectionCTemplate.objects.all()
    permission_classes = [HasAppAccess]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SectionCTemplateCreateSerializer
        return SectionCTemplateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(content__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        template = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} created Section C template: {template.name}"
        )


class SectionCTemplateDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve a Section C template.
    PATCH/PUT: Update a template.
    DELETE: Delete a template.
    """

    queryset = SectionCTemplate.objects.all()
    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return SectionCTemplateCreateSerializer
        return SectionCTemplateSerializer

    def perform_update(self, serializer):
        template = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} updated Section C template: {template.name}"
        )

    def perform_destroy(self, instance):
        name = instance.name
        instance.delete()
        settings.LOGGER.info(
            f"User {self.request.user} deleted Section C template: {name}"
        )
