from rest_framework import serializers
from medias.models import UserAvatar


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
