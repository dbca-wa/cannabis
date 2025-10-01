from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import SubmissionComment, CommentReaction, Notification


class CommentReactionInline(admin.TabularInline):
    """Inline for showing reactions on a comment"""
    model = CommentReaction
    extra = 0
    readonly_fields = ('user', 'reaction', 'created_at')
    fields = ('user', 'reaction', 'created_at')
    can_delete = True
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(SubmissionComment)
class SubmissionCommentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'submission_link',
        'author_name',
        'text_preview',
        'reaction_count',
        'created_at',
    )
    list_filter = (
        'created_at',
        'updated_at',
        'user__role',
    )
    search_fields = (
        'text',
        'user__first_name',
        'user__last_name',
        'user__email',
        'submission__case_number',
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Comment Details', {
            'fields': ('user', 'submission', 'text'),
            'classes': ('wide',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    inlines = [CommentReactionInline]
    
    def submission_link(self, obj):
        """Link to the related submission"""
        if obj.submission:
            url = reverse('admin:submissions_submission_change', args=[obj.submission.pk])
            return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)
        return "No submission"
    submission_link.short_description = 'Submission'
    
    def author_name(self, obj):
        """Display comment author name"""
        if obj.user:
            return obj.user.full_name if hasattr(obj.user, 'full_name') else obj.user.email
        return "Unknown"
    author_name.short_description = 'Author'
    
    def text_preview(self, obj):
        """Show preview of comment text"""
        if len(obj.text) > 100:
            return f"{obj.text[:100]}..."
        return obj.text
    text_preview.short_description = 'Comment'
    
    def reaction_count(self, obj):
        """Show number of reactions"""
        count = obj.reactions.count()
        if count > 0:
            return format_html(
                '<span style="background: #e8f4fd; padding: 2px 6px; border-radius: 3px;">{} reactions</span>',
                count
            )
        return "No reactions"
    reaction_count.short_description = 'Reactions'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'submission').prefetch_related('reactions')


@admin.register(CommentReaction)
class CommentReactionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'reaction_emoji',
        'comment_preview',
        'created_at',
    )
    list_filter = (
        'reaction',
        'created_at',
    )
    search_fields = (
        'user__first_name',
        'user__last_name',
        'user__email',
        'comment__text',
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
    
    def reaction_emoji(self, obj):
        """Show reaction with emoji"""
        reaction_map = {
            'thumbup': '👍',
            'heart': '❤️',
            'sad': '😢',
            'angry': '😡',
            'laugh': '😂',
        }
        emoji = reaction_map.get(obj.reaction, '❓')
        return format_html(
            '<span style="font-size: 16px;">{}</span> {}',
            emoji,
            obj.get_reaction_display()
        )
    reaction_emoji.short_description = 'Reaction'
    
    def comment_preview(self, obj):
        """Show preview of the comment being reacted to"""
        if len(obj.comment.text) > 50:
            return f"{obj.comment.text[:50]}..."
        return obj.comment.text
    comment_preview.short_description = 'Comment'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'comment')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'recipient',
        'notification_type_colored',
        'priority_badge',
        'is_read',
        'created_at',
    )
    list_filter = (
        'notification_type',
        'priority',
        'is_read',
        'created_at',
        'expires_at',
    )
    search_fields = (
        'title',
        'message',
        'recipient__first_name',
        'recipient__last_name',
        'recipient__email',
        'actor__first_name',
        'actor__last_name',
        'actor__email',
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'content_type', 'object_id')
    
    fieldsets = (
        ('Recipients & Actors', {
            'fields': ('recipient', 'actor'),
            'classes': ('wide',),
        }),
        ('Notification Content', {
            'fields': (
                'notification_type',
                'title',
                'message',
                'action_url',
            ),
            'classes': ('wide',),
        }),
        ('Status & Metadata', {
            'fields': (
                'priority',
                'is_read',
                'read_at',
                'expires_at',
            ),
            'classes': ('wide',),
        }),
        ('Related Object', {
            'fields': ('content_type', 'object_id'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',),
        }),
    )
    
    # Custom actions
    actions = ['mark_as_read', 'mark_as_unread', 'delete_expired']
    
    def notification_type_colored(self, obj):
        """Color-coded notification types"""
        colors = {
            'submission_assigned': '#28a745',
            'submission_phase_changed': '#17a2b8',
            'botanist_approval_needed': '#ffc107',
            'finance_approval_needed': '#fd7e14',
            'certificate_generated': '#6f42c1',
            'invoice_generated': '#e83e8c',
            'comment_added': '#20c997',
            'mention': '#dc3545',
        }
        color = colors.get(obj.notification_type, '#6c757d')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_notification_type_display()
        )
    notification_type_colored.short_description = 'Type'
    
    def priority_badge(self, obj):
        """Show priority with appropriate styling"""
        colors = {
            'low': '#28a745',
            'normal': '#6c757d',
            'high': '#ffc107',
            'urgent': '#dc3545',
        }
        color = colors.get(obj.priority, '#6c757d')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_priority_display().upper()
        )
    priority_badge.short_description = 'Priority'
    
    def mark_as_read(self, request, queryset):
        """Mark selected notifications as read"""
        from django.utils import timezone
        updated = queryset.update(is_read=True, read_at=timezone.now())
        self.message_user(request, f'{updated} notifications marked as read')
    mark_as_read.short_description = 'Mark selected notifications as read'
    
    def mark_as_unread(self, request, queryset):
        """Mark selected notifications as unread"""
        updated = queryset.update(is_read=False, read_at=None)
        self.message_user(request, f'{updated} notifications marked as unread')
    mark_as_unread.short_description = 'Mark selected notifications as unread'
    
    def delete_expired(self, request, queryset):
        """Delete expired notifications"""
        from django.utils import timezone
        expired = queryset.filter(expires_at__lt=timezone.now())
        count = expired.count()
        expired.delete()
        self.message_user(request, f'{count} expired notifications deleted')
    delete_expired.short_description = 'Delete expired notifications'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('recipient', 'actor', 'content_type')