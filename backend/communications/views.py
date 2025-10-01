from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import *
from django.db.models import Q, Count, Prefetch
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType

from .models import SubmissionComment, CommentReaction, Notification, NotificationTypes
from .serializers import (
    SubmissionCommentSerializer,
    SubmissionCommentCreateSerializer,
    CommentReactionSerializer,
    ReactionToggleSerializer,
    NotificationSerializer,
    NotificationMarkReadSerializer,
)
from .utils import ReactionService


# ============================================================================
# region SUBMISSION COMMENT VIEWS
# ============================================================================

class SubmissionCommentListView(ListCreateAPIView):
    """
    GET: List comments for a specific submission
    POST: Create new comment
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubmissionCommentCreateSerializer
        return SubmissionCommentSerializer
    
    def get_queryset(self):
        submission_id = self.kwargs.get('submission_id')
        return SubmissionComment.objects.filter(
            submission_id=submission_id
        ).select_related('user', 'submission').prefetch_related(
            Prefetch('reactions', queryset=CommentReaction.objects.select_related('user'))
        ).order_by('created_at')  # Chronological order for comments
    
    def perform_create(self, serializer):
        comment = serializer.save()
        settings.LOGGER.info(f"User {self.request.user} created comment on submission {comment.submission.id}")
            
    def create_comment_notifications(self, comment):
        """Create notifications for relevant users when comment is added"""
        
        User = get_user_model()

        # Get submission stakeholders
        stakeholders = set()
        submission = comment.submission
        
        # Add assigned staff members
        if submission.approved_botanist:
            stakeholders.add(submission.approved_botanist)
        
        if submission.finance_officer:
            stakeholders.add(submission.finance_officer)
        
        # Add other users who have commented on this submission
        previous_commenters = User.objects.filter(
            submission_comments__submission=submission
        ).exclude(
            id=comment.user.id if comment.user else None
        ).distinct()
        
        stakeholders.update(previous_commenters)
        
        # Remove the person who just commented
        if comment.user:
            stakeholders.discard(comment.user)
        
        # Create notifications for each stakeholder
        notifications = []
        for user in stakeholders:
            # Check user preferences for comment notifications
            if hasattr(user, 'preferences') and not user.preferences.comment_notifications:
                continue
                
            notification = Notification(
                recipient=user,
                actor=comment.user,
                notification_type=NotificationTypes.COMMENT_ADDED,
                title=f"New comment on case {submission.case_number}",
                message=f"{comment.user.full_name if comment.user else 'Unknown'} commented: {comment.text[:100]}{'...' if len(comment.text) > 100 else ''}",
                action_url=f"/submissions/{submission.id}#comment-{comment.id}",
                priority=Notification.PriorityLevels.NORMAL,
                # Link to the submission object
                content_type_id=ContentType.objects.get_for_model(submission).id,
                object_id=submission.id,
            )
            notifications.append(notification)
        
        # Bulk create notifications
        if notifications:
            Notification.objects.bulk_create(notifications)
            settings.LOGGER.info(f"Created {len(notifications)} comment notifications for submission {submission.case_number}")



class SubmissionCommentDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve comment details
    PUT/PATCH: Update comment (author or admin only)
    DELETE: Delete comment (author or admin only)
    """
    queryset = SubmissionComment.objects.all().select_related('user', 'submission')
    serializer_class = SubmissionCommentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """Get comment with optimized queries"""
        return get_object_or_404(
            SubmissionComment.objects.select_related('user', 'submission').prefetch_related(
                Prefetch('reactions', queryset=CommentReaction.objects.select_related('user'))
            ),
            pk=self.kwargs['pk']
        )
    
    def check_object_permissions(self, request, obj):
        """Only comment author or admin can modify"""
        super().check_object_permissions(request, obj)
        
        if request.method in ['PUT', 'PATCH', 'DELETE']:
            if not (obj.user == request.user or request.user.is_staff):
                self.permission_denied(request, "You can only modify your own comments.")
    
    def perform_update(self, serializer):
        settings.LOGGER.info(f"User {self.request.user} updated comment {serializer.instance.id}")
        serializer.save()
    
    def perform_destroy(self, instance):
        settings.LOGGER.warning(f"User {self.request.user} deleted comment {instance.id}")
        super().perform_destroy(instance)


# endregion

# ============================================================================
# region COMMENT REACTION VIEWS
# ============================================================================

class CommentReactionToggleView(APIView):
    """
    POST: Toggle reaction on a comment
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, comment_id):
        try:
            comment = SubmissionComment.objects.get(pk=comment_id)
        except SubmissionComment.DoesNotExist:
            return Response(
                {"error": "Comment not found"}, 
                status=HTTP_404_NOT_FOUND
            )
        
        serializer = ReactionToggleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        
        reaction_type = serializer.validated_data['reaction']
        
        # Use the reaction service
        reaction, action = ReactionService.toggle_reaction(
            user=request.user,
            comment=comment,
            reaction_type=reaction_type
        )
        
        # Log the action
        settings.LOGGER.info(f"User {request.user} {action} reaction {reaction_type} on comment {comment_id}")
        
        # Return updated reaction data
        if reaction:
            reaction_data = CommentReactionSerializer(reaction).data
        else:
            reaction_data = None
        
        # Get updated reaction summary
        reaction_summary = ReactionService.get_reaction_summary(comment)
        
        return Response({
            "action": action,
            "reaction": reaction_data,
            "reaction_summary": reaction_summary,
        }, status=HTTP_200_OK)


class CommentReactionListView(ListAPIView):
    """
    GET: List all reactions for a comment
    """
    serializer_class = CommentReactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        comment_id = self.kwargs.get('comment_id')
        return CommentReaction.objects.filter(
            comment_id=comment_id
        ).select_related('user').order_by('-created_at')

# endregion

# ============================================================================
# region NOTIFICATION VIEWS
# ============================================================================

class NotificationListView(ListAPIView):
    """
    GET: List notifications for current user with filtering
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Notification.objects.for_user(self.request.user).select_related('actor')
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        # Filter by notification type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        
        # Filter out expired notifications unless explicitly requested
        include_expired = self.request.query_params.get('include_expired', 'false')
        if include_expired.lower() != 'true':
            from django.utils import timezone
            queryset = queryset.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
            )
        
        return queryset.order_by('-created_at')


class NotificationDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Get notification details
    PATCH: Update notification (mark as read/unread)
    DELETE: Delete notification
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.for_user(self.request.user)
    
    def perform_update(self, serializer):
        # Auto-set read_at when marking as read
        if serializer.validated_data.get('is_read') and not serializer.instance.is_read:
            from django.utils import timezone
            serializer.save(read_at=timezone.now())
        elif not serializer.validated_data.get('is_read', True):
            serializer.save(read_at=None)
        else:
            serializer.save()


class NotificationMarkReadView(APIView):
    """
    POST: Mark notifications as read/unread (bulk operation)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        
        is_read = serializer.validated_data['is_read']
        notification_ids = serializer.validated_data.get('notification_ids')
        
        # Get base queryset for current user
        queryset = Notification.objects.for_user(request.user)
        
        # Filter by specific IDs if provided, otherwise use all unread
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        elif is_read:
            # If marking as read without specific IDs, mark all unread
            queryset = queryset.unread()
        else:
            # If marking as unread without specific IDs, mark all read
            queryset = queryset.filter(is_read=True)
        
        # Update notifications
        if is_read:
            from django.utils import timezone
            updated_count = queryset.update(is_read=True, read_at=timezone.now())
        else:
            updated_count = queryset.update(is_read=False, read_at=None)
        
        action = "marked as read" if is_read else "marked as unread"
        settings.LOGGER.info(f"User {request.user} {action} {updated_count} notifications")
        
        return Response({
            "message": f"{updated_count} notifications {action}",
            "updated_count": updated_count,
        }, status=HTTP_200_OK)


class NotificationStatsView(APIView):
    """
    GET: Get notification statistics for current user
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user_notifications = Notification.objects.for_user(request.user)
        
        stats = {
            "total": user_notifications.count(),
            "unread": user_notifications.unread().count(),
            "recent": user_notifications.recent().count(),
            "by_priority": {
                priority[0]: user_notifications.filter(priority=priority[0]).count()
                for priority in Notification.PriorityLevels.choices
            },
            "by_type": {}
        }
        
        # Get counts by notification type
        type_counts = user_notifications.values('notification_type').annotate(
            count=Count('notification_type')
        )
        
        for type_count in type_counts:
            stats["by_type"][type_count['notification_type']] = type_count['count']
        
        return Response(stats, status=HTTP_200_OK)
# endregion