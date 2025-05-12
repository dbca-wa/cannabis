from datetime import timezone
from django.db import models

from users.models import User


class CommonModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        """Mark record as deleted"""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])


class AuditModel(CommonModel):

    created_by = models.ForeignKey(
        User,
        related_name="%(class)s_created",
        on_delete=models.SET_NULL,
        null=True,
    )

    updated_by = models.ForeignKey(
        User, related_name="%(class)s_updated", on_delete=models.SET_NULL, null=True
    )

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        """(Override) Mark record as deleted"""
        self.deleted_at = timezone.now()
        if user:
            self.updated_by = user
            self.save(update_fields=["deleted_at", "updated_by", "updated_at"])
        else:
            super().soft_delete()
