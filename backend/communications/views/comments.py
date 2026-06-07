from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from ..models import CommentReaction, Notification, NotificationTypes, SubmissionComment
from ..serializers import (
    CommentReactionSerializer,
    ReactionToggleSerializer,
    SubmissionCommentCreateSerializer,
    SubmissionCommentSerializer,
)
from ..utils import ReactionService

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
        if self.request.method == "POST":
            return SubmissionCommentCreateSerializer
        return SubmissionCommentSerializer

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return (
            SubmissionComment.objects.filter(submission_id=pk)
            .select_related("user", "submission")
            .prefetch_related(
                Prefetch(
                    "reactions", queryset=CommentReaction.objects.select_related("user")
                )
            )
            .order_by("created_at")
        )  # Chronological order for comments

    def perform_create(self, serializer):
        comment = serializer.save()
        settings.LOGGER.info(
            f"User {self.request.user} created comment on submission {comment.submission.id}"
        )

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
        previous_commenters = (
            User.objects.filter(submission_comments__submission=submission)
            .exclude(id=comment.user.id if comment.user else None)
            .distinct()
        )

        stakeholders.update(previous_commenters)

        # Remove the person who just commented
        if comment.user:
            stakeholders.discard(comment.user)

        # Create notifications for each stakeholder
        notifications = []
        for user in stakeholders:
            # Check user preferences for comment notifications
            if (
                hasattr(user, "preferences")
                and not user.preferences.comment_notifications
            ):
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
            settings.LOGGER.info(
                f"Created {len(notifications)} comment notifications for submission {submission.case_number}"
            )


class SubmissionCommentDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve comment details
    PUT/PATCH: Update comment (author or admin only)
    DELETE: Delete comment (author or admin only)
    """

    queryset = SubmissionComment.objects.all().select_related("user", "submission")
    serializer_class = SubmissionCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Get comment with optimized queries"""
        return get_object_or_404(
            SubmissionComment.objects.select_related(
                "user", "submission"
            ).prefetch_related(
                Prefetch(
                    "reactions", queryset=CommentReaction.objects.select_related("user")
                )
            ),
            pk=self.kwargs["pk"],
        )

    def check_object_permissions(self, request, obj):
        """Only comment author or admin can modify"""
        super().check_object_permissions(request, obj)

        if request.method in ["PUT", "PATCH", "DELETE"]:
            if not (obj.user == request.user or request.user.is_staff):
                self.permission_denied(
                    request, "You can only modify your own comments."
                )

    def perform_update(self, serializer):
        settings.LOGGER.info(
            f"User {self.request.user} updated comment {serializer.instance.id}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        settings.LOGGER.warning(
            f"User {self.request.user} deleted comment {instance.id}"
        )
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
            raise NotFound("Comment not found.")

        serializer = ReactionToggleSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        reaction_type = serializer.validated_data["reaction"]

        # Use the reaction service
        reaction, action = ReactionService.toggle_reaction(
            user=request.user, comment=comment, reaction_type=reaction_type
        )

        # Log the action
        settings.LOGGER.info(
            f"User {request.user} {action} reaction {reaction_type} on comment {comment_id}"
        )

        # Return updated reaction data
        if reaction:
            reaction_data = CommentReactionSerializer(reaction).data
        else:
            reaction_data = None

        # Get updated reaction summary
        reaction_summary = ReactionService.get_reaction_summary(comment)

        return Response(
            {
                "action": action,
                "reaction": reaction_data,
                "reaction_summary": reaction_summary,
            },
            status=HTTP_200_OK,
        )


class CommentReactionListView(ListAPIView):
    """
    GET: List all reactions for a comment
    """

    serializer_class = CommentReactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        comment_id = self.kwargs.get("comment_id")
        return (
            CommentReaction.objects.filter(comment_id=comment_id)
            .select_related("user")
            .order_by("-created_at")
        )


# endregion
