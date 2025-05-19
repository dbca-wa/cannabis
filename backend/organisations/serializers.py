from rest_framework import serializers
from .models import PoliceStation


class OrganisationListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoliceStation
        fields = ["id", "name"]  # Basic information for the list view


class OrganisationDetailViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoliceStation
        fields = [
            "id",
            "name",
            "address",
            "phone_number",
            "email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
