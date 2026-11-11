"""Defendant CRUD views — list, create, retrieve, update, delete."""

from django.shortcuts import get_object_or_404
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from cases.services.reassignment import describe_case, replacement_from_request
from users.permissions import HasAppAccess

from ..models import Defendant
from ..serializers import DefendantSerializer, DefendantTinySerializer
from ..services import DefendantService


class DefendantListCreateView(ListCreateAPIView):
    """List all defendants with search/pagination/sorting, or create a new one."""

    permission_classes = [HasAppAccess]

    def get_serializer_class(self):
        if self.request.method == "GET":
            if self.request.query_params.get("full") == "true":
                return DefendantSerializer
            return DefendantTinySerializer
        return DefendantSerializer

    def get_queryset(self):
        search = self.request.query_params.get("search")
        ordering = self.request.query_params.get("ordering", "last_name")
        # Selection dropdowns pass selectable=true to hide placeholder records
        selectable = self.request.query_params.get("selectable") == "true"
        return DefendantService.get_queryset(
            search=search, ordering=ordering, selectable_only=selectable
        )

    def perform_create(self, serializer):
        serializer.instance = DefendantService.create_defendant(
            serializer.validated_data, self.request.user
        )


class DefendantRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a defendant."""

    permission_classes = [HasAppAccess]
    serializer_class = DefendantSerializer

    def get_queryset(self):
        return DefendantService.get_queryset()

    def perform_update(self, serializer):
        serializer.instance = DefendantService.update_defendant(
            serializer.instance, serializer.validated_data, self.request.user
        )

    def perform_destroy(self, instance):
        # Cases naming this defendant are moved to ?replacement=<id> first, so
        # no case loses its defendant.
        replacement = replacement_from_request(
            self.request, Defendant.objects.all(), "defendant"
        )
        DefendantService.delete_defendant(instance, self.request.user, replacement)


class DefendantUsageView(APIView):
    """GET: the cases that name a defendant, shown before deleting them."""

    permission_classes = [HasAppAccess]

    def get(self, request, pk):
        defendant = get_object_or_404(Defendant, pk=pk)
        return Response(
            {
                "cases": [
                    describe_case(case, ["defendant"])
                    for case in DefendantService.case_usage(defendant)
                ]
            }
        )
