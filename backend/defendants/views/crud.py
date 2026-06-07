"""Defendant CRUD views — list, create, retrieve, update, delete."""

from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from ..serializers import DefendantSerializer, DefendantTinySerializer
from ..services import DefendantService


class DefendantListCreateView(ListCreateAPIView):
    """List all defendants with search/pagination/sorting, or create a new one."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            if self.request.query_params.get("full") == "true":
                return DefendantSerializer
            return DefendantTinySerializer
        return DefendantSerializer

    def get_queryset(self):
        search = self.request.query_params.get("search")
        ordering = self.request.query_params.get("ordering", "last_name")
        return DefendantService.get_queryset(search=search, ordering=ordering)

    def perform_create(self, serializer):
        serializer.save()


class DefendantRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a defendant."""

    permission_classes = [IsAuthenticated]
    serializer_class = DefendantSerializer

    def get_queryset(self):
        return DefendantService.get_queryset()

    def perform_destroy(self, instance):
        DefendantService.delete_defendant(instance, self.request.user)
