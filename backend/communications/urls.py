from django.urls import path

from . import views

urlpatterns = [
    # Case Comments
    path(
        "cases/<int:pk>/comments",
        views.SubmissionCommentListView.as_view(),
        name="submission_comments",
    ),
    path(
        "comments/<int:pk>",
        views.SubmissionCommentDetailView.as_view(),
        name="comment_detail",
    ),
    # Comment Reactions
    path(
        "comments/<int:comment_id>/react",
        views.CommentReactionToggleView.as_view(),
        name="comment_react",
    ),
    path(
        "comments/<int:comment_id>/reactions",
        views.CommentReactionListView.as_view(),
        name="comment_reactions",
    ),
    # Notifications
    path(
        "notifications",
        views.NotificationListView.as_view(),
        name="notification_list",
    ),
    path(
        "notifications/<int:pk>",
        views.NotificationDetailView.as_view(),
        name="notification_detail",
    ),
    path(
        "notifications/mark-read",
        views.NotificationMarkReadView.as_view(),
        name="notifications_mark_read",
    ),
    path(
        "notifications/stats",
        views.NotificationStatsView.as_view(),
        name="notification_stats",
    ),
    # Test Email
    path(
        "test-email",
        views.SendTestEmailView.as_view(),
        name="send_test_email",
    ),
]
