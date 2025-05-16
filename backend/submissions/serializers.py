from rest_framework import serializers
from .models import Baggy, Certificate, Submission


class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ("id", "created_at", "updated_at", )
        read_only_fields = ("created_at",)

class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = ("id", "created_at", "updated_at", )
        read_only_fields = ("created_at")

class BaggySerializer(serializers.ModelSerializer):
    class Meta:
        model = Baggy
        fields = ("id", "created_at", "updated_at", )
        read_only_fields = ("created_at",)

