from django.db import models
from django.contrib.auth import get_user_model

from common.models import CommonModel

User = get_user_model()


class UserAvatar(CommonModel):
    """
    Model for storing user avatar images.
    One-to-one relationship with User.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="avatar")
    image = models.ImageField(upload_to="avatars/")

    def __str__(self):
        return f"Avatar for {self.user.email}"

    class Meta:
        ordering = ["-created_at"]
