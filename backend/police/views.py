from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from django.db.models import Q
from django.conf import settings

from .models import PoliceStation, PoliceOfficer
from .serializers import (
    PoliceStationSerializer,
    PoliceStationTinySerializer,
    PoliceOfficerSerializer,
    PoliceOfficerTinySerializer,
    PoliceOfficerCreateSerializer,
)


# ============================================================================
# region POLICE STATION VIEWS
# ============================================================================

class PoliceStationListView(ListCreateAPIView):
    """
    GET: List all police stations with search/filtering
    POST: Create new police station
    """
    queryset = PoliceStation.objects.all().order_by('name')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get('full') == 'true':
                return PoliceStationSerializer
            return PoliceStationTinySerializer
        return PoliceStationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(address__icontains=search)
            )
        
        # Filter by stations with officers
        has_officers = self.request.query_params.get('has_officers')
        if has_officers is not None:
            if has_officers.lower() == 'true':
                queryset = queryset.filter(officers__isnull=False).distinct()
            else:
                queryset = queryset.filter(officers__isnull=True)
        
        return queryset
    
    def perform_create(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} created police station: {serializer.validated_data['name']}")
        serializer.save()


class PoliceStationDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve police station details
    PUT/PATCH: Update police station
    DELETE: Delete police station
    """
    queryset = PoliceStation.objects.all()
    serializer_class = PoliceStationSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_update(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} updated police station: {serializer.instance}")
        serializer.save()
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted police station: {instance}")
        super().perform_destroy(instance)

# endregion


# ============================================================================
# region POLICE OFFICER VIEWS
# ============================================================================

class PoliceOfficerListView(ListCreateAPIView):
    """
    GET: List all police officers with search/filtering
    POST: Create new police officer
    """
    queryset = PoliceOfficer.objects.all().select_related('station').order_by('last_name', 'first_name')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PoliceOfficerCreateSerializer
        elif self.request.method == 'GET':
            # Use tiny serializer for lists unless ?full=true
            if self.request.query_params.get('full') == 'true':
                return PoliceOfficerSerializer
            return PoliceOfficerTinySerializer
        return PoliceOfficerSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(badge_number__icontains=search) |
                Q(station__name__icontains=search)
            )
        
        # Filter by rank
        rank = self.request.query_params.get('rank')
        if rank:
            queryset = queryset.filter(rank=rank)
        
        # Filter by sworn/unsworn officers
        is_sworn = self.request.query_params.get('is_sworn')
        if is_sworn is not None:
            sworn_ranks = [
                PoliceOfficer.SeniorityChoices.OFFICER,
                PoliceOfficer.SeniorityChoices.PROBATION_CONSTABLE,
                PoliceOfficer.SeniorityChoices.CONSTABLE,
                PoliceOfficer.SeniorityChoices.DETECTIVE,
                PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE,
                PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
                PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE,
                PoliceOfficer.SeniorityChoices.CONVEYING_OFFICER,
            ]
            if is_sworn.lower() == 'true':
                queryset = queryset.filter(rank__in=sworn_ranks)
            else:
                queryset = queryset.exclude(rank__in=sworn_ranks)
        
        # Filter by station
        station_id = self.request.query_params.get('station')
        if station_id:
            queryset = queryset.filter(station_id=station_id)
        
        # Filter officers without stations
        no_station = self.request.query_params.get('no_station')
        if no_station is not None and no_station.lower() == 'true':
            queryset = queryset.filter(station__isnull=True)
        
        return queryset
    
    def perform_create(self, serializer):
        officer = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created police officer: {officer}")


class PoliceOfficerDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve police officer details
    PUT/PATCH: Update police officer
    DELETE: Delete police officer
    """
    queryset = PoliceOfficer.objects.all().select_related('station')
    serializer_class = PoliceOfficerSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_update(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} updated police officer: {serializer.instance}")
        serializer.save()
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted police officer: {instance}")
        super().perform_destroy(instance)

# endregion