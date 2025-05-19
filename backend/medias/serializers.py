from rest_framework import serializers
from medias.models import CertificatePDF, UserAvatar
from submissions.serializers import CertificateSerializer


class UserAvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAvatar
        fields = ("id", "image", "created_at")
        read_only_fields = ("created_at",)

    def create(self, validated_data):
        # Set the user to the current user
        user = self.context["request"].user
        validated_data["user"] = user

        # Check if user already has an avatar and delete it
        UserAvatar.objects.filter(user=user).delete()

        return super().create(validated_data)


class CertificatePDFSerializer(serializers.ModelSerializer):

    certificate = CertificateSerializer(read_only=True)

    class Meta:
        model = CertificatePDF
        fields = ("id", "file", "size", "certificate")
        read_only_fields = ("id", "size")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from submissions.models import (
            Certificate,
        )  # Import here to avoid circular imports

        self.fields["certificate"].queryset = Certificate.objects.all()
