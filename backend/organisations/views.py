from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from .models import PoliceStation
from .serializers import (
    OrganisationListViewSerializer,
    OrganisationDetailViewSerializer,
)


class Organisations(APIView):
    """
    View to list all police stations and create new police stations.
    """

    def get(self, request):
        police_stations = PoliceStation.objects.all()
        serializer = OrganisationListViewSerializer(police_stations, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrganisationDetailViewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrganisationDetail(APIView):
    """
    View to retrieve, update, and delete a single police station instance.
    """

    def get_object(self, id):
        return get_object_or_404(PoliceStation, id=id)

    def get(self, request, id):
        police_station = self.get_object(id)
        serializer = OrganisationDetailViewSerializer(police_station)
        return Response(serializer.data)

    def put(self, request, id):
        police_station = self.get_object(id)
        serializer = OrganisationDetailViewSerializer(police_station, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        police_station = self.get_object(id)
        police_station.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
