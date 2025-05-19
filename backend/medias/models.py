from tabnanny import verbose
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
        verbose_name = "User Avatar"
        verbose_name_plural = "User Avatars"
        ordering = ["-created_at"]


class CertificatePDF(CommonModel):
    """
    Model for storing reference to file for PDF certificate
    """

    file = models.FileField(upload_to="certificates/", null=True, blank=True)
    size = models.PositiveIntegerField(default=0)
    certificate = models.OneToOneField(
        "submissions.Certificate",
        on_delete=models.CASCADE,
        related_name="pdf",
    )
    # cert will contain reference to submission

    def __str__(self) -> str:
        return f"PDF for {self.certificate}"

    """
        update size on save
    """

    def save(self, *args, **kwargs):
        if self.file:
            self.size = self.file.size
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Certificate PDF"
        verbose_name_plural = "Certificate PDFs"
