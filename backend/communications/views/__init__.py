"""Communications views package.

Re-exports all view classes so that existing imports like
``from . import views`` followed by ``views.SubmissionCommentListView`` continue to work.
"""

from .comments import (  # noqa: F401
    CommentReactionListView,
    CommentReactionToggleView,
    SubmissionCommentDetailView,
    SubmissionCommentListView,
)
from .email import SendTestEmailView  # noqa: F401
from .notifications import (  # noqa: F401
    NotificationDetailView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationStatsView,
)

__all__ = [
    "SubmissionCommentListView",
    "SubmissionCommentDetailView",
    "CommentReactionToggleView",
    "CommentReactionListView",
    "NotificationListView",
    "NotificationDetailView",
    "NotificationMarkReadView",
    "NotificationStatsView",
    "SendTestEmailView",
]
