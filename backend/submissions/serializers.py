from rest_framework import serializers
from .models import Baggy, Certificate, Submission


class BaggySerializer(serializers.ModelSerializer):
    item_type_display = serializers.CharField(
        source="get_item_type_display", read_only=True
    )
    botanist_determination_display = serializers.CharField(
        source="get_botanist_determination_display", read_only=True
    )

    class Meta:
        model = Baggy
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class CertificateSerializer(serializers.ModelSerializer):
    total_fee = serializers.SerializerMethodField()
    baggy_count = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def get_total_fee(self, obj):
        """Calculate total fee based on identification_fee * number of baggies"""
        baggy_count = obj.submission.baggies.count()
        return obj.identification_fee * baggy_count

    def get_baggy_count(self, obj):
        """Get the number of baggies for this certificate's submission"""
        return obj.submission.baggies.count()


# Simple serializer for police/DBCA staff info
class StaffProfileSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user = serializers.SerializerMethodField()

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
        }


class PoliceStaffProfileSerializer(StaffProfileSerializer):
    police_id = serializers.CharField()
    seniority = serializers.CharField()
    seniority_display = serializers.CharField(
        source="get_seniority_display", read_only=True
    )
    sworn = serializers.BooleanField()


class DBCAStaffProfileSerializer(StaffProfileSerializer):
    role = serializers.CharField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)


class SubmissionListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views"""

    police_officer = PoliceStaffProfileSerializer(read_only=True)
    police_submitter = PoliceStaffProfileSerializer(read_only=True)
    dbca_submitter = DBCAStaffProfileSerializer(read_only=True)
    baggy_count = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            "id",
            "police_officer",
            "police_submitter",
            "dbca_submitter",
            "baggy_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_baggy_count(self, obj):
        return obj.baggies.count()


class SubmissionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with all related data"""

    police_officer = PoliceStaffProfileSerializer(read_only=True)
    police_submitter = PoliceStaffProfileSerializer(read_only=True)
    dbca_submitter = DBCAStaffProfileSerializer(read_only=True)
    baggies = BaggySerializer(many=True, read_only=True)
    certificates = CertificateSerializer(many=True, read_only=True)
    baggy_count = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def get_baggy_count(self, obj):
        return obj.baggies.count()


# Keep the original for backwards compatibility
class SubmissionSerializer(SubmissionListSerializer):
    """Original serializer - now inherits from list serializer"""

    pass
