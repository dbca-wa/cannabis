from django.db import models
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

from common.models import AuditModel



class SubmissionComment(AuditModel):
    """
    Model definition for Internal Comments on Submissions
    """
    user = models.ForeignKey(
        "users.User",
        # Maintain the content even if user deleted, frontend sets null to Unknown
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    text = models.CharField(
        max_length=1500,
    )

    # Helper methods for reactions
    def get_reaction_counts(self):
        """Get count of each reaction type"""
        from django.db.models import Count
        return self.reactions.values('reaction').annotate(count=Count('reaction'))
    
    def get_user_reaction(self, user):
        """Get specific user's reaction to this comment"""
        try:
            return self.reactions.get(user=user)
        except CommentReaction.DoesNotExist:
            return None
    
    def has_user_reacted(self, user):
        """Check if user has reacted to this comment"""
        return self.reactions.filter(user=user).exists()

    def __str__(self):
        username = self.user.full_name if self.user else "Unknown"
        return f"Comment by {username} on {self.submission.case_number}"
    
    class Meta:
        verbose_name = "Submission Comment"
        verbose_name_plural = "Submission Comments"
        ordering = ['-created_at']



class CommentReaction(models.Model):
    """
    Model definition for Reactions to Comments
    One reaction per user per comment
    """

    class ReactionChoices(models.TextChoices):
        THUMBUP = "thumbup", "👍 Thumbs Up"
        HEART = "heart", "❤️ Heart"
        SAD = "sad", "😢 Sad"
        ANGRY = "angry", "😡 Angry"
        LAUGH = "laugh", "😂 Laugh"

    reaction = models.CharField(
        max_length=30,
        choices=ReactionChoices.choices,
        help_text="Type of reaction",
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="comment_reactions",
        help_text="User who made the reaction",
    )
    comment = models.ForeignKey(
        "communications.SubmissionComment",
        on_delete=models.CASCADE,
        related_name="reactions",
        help_text="Comment being reacted to",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        username = self.user.full_name if hasattr(self.user, 'full_name') else self.user.email
        return f"{username} reacted {self.get_reaction_display()} to comment"

    class Meta:
        verbose_name = "Comment Reaction"
        verbose_name_plural = "Comment Reactions"
        # ensures one reaction per user per comment
        unique_together = [['user', 'comment']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['comment', 'reaction']),  # For counting reactions
            models.Index(fields=['user', 'comment']),     # For checking if user reacted
        ]



class CommentReactionManager(models.Manager):
    """
    Service class for managing comment reactions
    """
    
    @staticmethod
    def toggle_reaction(user, comment, reaction_type):
        """
        Toggle a reaction - add if doesn't exist, update if different, remove if same
        Returns: (reaction_object or None, action_taken)
        """
        try:
            existing_reaction = CommentReaction.objects.get(user=user, comment=comment)
            
            if existing_reaction.reaction == reaction_type:
                # Same reaction - remove it (toggle off)
                existing_reaction.delete()
                return None, 'removed'
            else:
                # Different reaction - update it
                existing_reaction.reaction = reaction_type
                existing_reaction.save()
                return existing_reaction, 'updated'
                
        except CommentReaction.DoesNotExist:
            # No existing reaction - create new one
            new_reaction = CommentReaction.objects.create(
                user=user,
                comment=comment,
                reaction=reaction_type
            )
            return new_reaction, 'created'
    
    @staticmethod
    def remove_reaction(user, comment):
        """Remove user's reaction from comment"""
        try:
            reaction = CommentReaction.objects.get(user=user, comment=comment)
            reaction.delete()
            return True
        except CommentReaction.DoesNotExist:
            return False
    
    @staticmethod
    def get_reaction_summary(comment):
        """Get summary of all reactions on a comment"""
        from django.db.models import Count
        
        reactions = CommentReaction.objects.filter(comment=comment).values('reaction').annotate(
            count=Count('reaction')
        ).order_by('-count')
        
        return {
            'total_reactions': sum(r['count'] for r in reactions),
            'reaction_breakdown': reactions,
            'reaction_counts': {r['reaction']: r['count'] for r in reactions}
        }





class NotificationTypes(models.TextChoices):
    # Submission workflow
    SUBMISSION_ASSIGNED = "submission_assigned", "Submission Assigned"
    SUBMISSION_PHASE_CHANGED = "submission_phase_changed", "Phase Changed"
    BOTANIST_APPROVAL_NEEDED = "botanist_approval_needed", "Botanist Approval Needed"
    FINANCE_APPROVAL_NEEDED = "finance_approval_needed", "Finance Approval Needed"
    
    # Document generation
    CERTIFICATE_GENERATED = "certificate_generated", "Certificate Generated"
    INVOICE_GENERATED = "invoice_generated", "Invoice Generated"
    PDF_GENERATION_FAILED = "pdf_generation_failed", "PDF Generation Failed"
    
    # System notifications
    SYSTEM_MAINTENANCE = "system_maintenance", "System Maintenance"
    SETTINGS_UPDATED = "settings_updated", "Settings Updated"
    
    # General
    MENTION = "mention", "You were mentioned"
    COMMENT_ADDED = "comment_added", "New Comment"



class NotificationManager(models.Manager):
    """Custom manager for notifications"""
    
    def unread(self):
        """Get all unread notifications"""
        return self.filter(is_read=False)
    
    def for_user(self, user):
        """Get notifications for a specific user"""
        return self.filter(recipient=user)
    
    def recent(self, days=7):
        """Get recent notifications within X days"""
        cutoff = timezone.now() - timezone.timedelta(days=days)
        return self.filter(created_at__gte=cutoff)




class Notification(models.Model):
    """
    General notification system for users
    """
    
    # Who gets the notification
    recipient = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="User who will receive this notification",
    )
    
    # Who/what triggered it (optional)
    actor = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications_sent',
        help_text="User who triggered this notification",
    )
    
    # What object this relates to (generic foreign key)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    target = GenericForeignKey('content_type', 'object_id')
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationTypes.choices,
        help_text="Type of notification",
    )
    
    title = models.CharField(
        max_length=255,
        help_text="Notification title/headline",
    )
    
    message = models.TextField(
        help_text="Notification message body",
    )
    action_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="URL to redirect to when notification is clicked",
    )
    
    # Status and metadata
    is_read = models.BooleanField(
        default=False,
        help_text="Whether the notification has been read",
    )
    
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the notification was read",
    )
    # Priority levels
    class PriorityLevels(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"
    
    priority = models.CharField(
        max_length=10,
        choices=PriorityLevels.choices,
        default=PriorityLevels.NORMAL,
        help_text="Notification priority level",
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this notification expires (optional)",
    )
    
    # Custom manager
    objects = NotificationManager()
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    def mark_as_unread(self):
        """Mark notification as unread"""
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=['is_read', 'read_at'])
    
    @property
    def is_expired(self):
        """Check if notification has expired"""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False
    
    @property
    def age(self):
        """Get human-readable age of notification"""
        diff = timezone.now() - self.created_at
        
        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days != 1 else ''} ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        else:
            return "Just now"
        
    def __str__(self):
        return f"{self.title} - {self.recipient.email}"

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['notification_type']),
        ]
