from django.db import models


class Signature(models.Model):
    """Stores a single digital signature image per user."""

    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="signature",
    )
    image = models.FileField(
        upload_to="signatures/",
        help_text="PNG or SVG signature image with transparent background",
    )
    content_type = models.CharField(
        max_length=20,
        choices=[
            ("image/png", "PNG"),
            ("image/svg+xml", "SVG"),
        ],
        help_text="MIME type of the stored image",
    )
    file_size = models.PositiveIntegerField(
        help_text="File size in bytes",
    )
    width = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Image width in pixels (PNG only)",
    )
    height = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Image height in pixels (PNG only)",
    )
    file_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 hex digest of the file contents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Signature"
        verbose_name_plural = "Signatures"

    def __str__(self):
        return f"Signature for {self.user.email}"


class SignatureAuditLog(models.Model):
    """Immutable audit trail for signature actions."""

    class ActionChoices(models.TextChoices):
        UPLOAD = "upload", "Upload"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        SIGN = "sign", "Sign"
        UNLOCK = "unlock", "Unlock"
        INTEGRITY_FAILURE = "integrity_failure", "Integrity Failure"

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="signature_audit_logs",
        help_text="User whose signature was acted upon",
    )
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="signature_actions_performed",
        help_text="User who performed the action",
    )
    action = models.CharField(
        max_length=20,
        choices=ActionChoices.choices,
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    content_type = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="MIME type of the signature at time of action",
    )
    file_size = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="File size at time of action",
    )
    file_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text="SHA-256 hash at time of action",
    )

    class Meta:
        verbose_name = "Signature Audit Log"
        verbose_name_plural = "Signature Audit Logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
        ]

    def save(self, *args, **kwargs):
        """Prevent updates to existing audit entries (immutability)."""
        if self.pk:
            raise ValueError("Audit log entries cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Prevent deletion of audit entries (immutability)."""
        raise ValueError("Audit log entries cannot be deleted.")

    def __str__(self):
        return f"{self.get_action_display()} by {self.actor} for {self.user} at {self.timestamp}"
