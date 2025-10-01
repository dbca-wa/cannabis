from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import SubmissionComment, CommentReaction, Notification

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for comment authors"""
    full_name = serializers.ReadOnlyField()
    initials = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'full_name', 'initials', 'role']
    
    def get_initials(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name[0]}{obj.last_name[0]}".upper()
        return obj.email[0].upper()


class CommentReactionSerializer(serializers.ModelSerializer):
    """Serializer for comment reactions"""
    user_details = CommentAuthorSerializer(source='user', read_only=True)
    reaction_display = serializers.CharField(source='get_reaction_display', read_only=True)
    
    class Meta:
        model = CommentReaction
        fields = [
            'id',
            'reaction',
            'reaction_display',
            'user',
            'user_details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SubmissionCommentSerializer(serializers.ModelSerializer):
    """Complete serializer for submission comments"""
    author = CommentAuthorSerializer(source='user', read_only=True)
    reactions = CommentReactionSerializer(many=True, read_only=True)
    reaction_counts = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    
    class Meta:
        model = SubmissionComment
        fields = [
            'id',
            'text',
            'author',
            'submission',
            'reactions',
            'reaction_counts',
            'user_reaction',
            'can_edit',
            'age',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_reaction_counts(self, obj):
        """Get count of each reaction type"""
        return {
            reaction['reaction']: reaction['count']
            for reaction in obj.get_reaction_counts()
        }
    
    def get_user_reaction(self, obj):
        """Get current user's reaction to this comment"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user_reaction = obj.get_user_reaction(request.user)
            return user_reaction.reaction if user_reaction else None
        return None
    
    def get_can_edit(self, obj):
        """Check if current user can edit this comment"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            # User can edit their own comments or admins can edit any
            return obj.user == user or user.is_superuser
        return False
    
    def get_age(self, obj):
        """Get human-readable age of comment"""
        from django.utils import timezone
        diff = timezone.now() - obj.created_at
        
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


class SubmissionCommentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating comments"""
    
    class Meta:
        model = SubmissionComment
        fields = ['text', 'submission']
    
    def validate_text(self, value):
        """Ensure comment text is not empty after stripping whitespace"""
        if not value.strip():
            raise serializers.ValidationError("Comment cannot be empty.")
        return value.strip()
    
    def create(self, validated_data):
        """Create comment with current user as author"""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ReactionToggleSerializer(serializers.Serializer):
    """Serializer for toggling reactions"""
    reaction = serializers.ChoiceField(choices=CommentReaction.ReactionChoices.choices)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications"""
    actor_details = CommentAuthorSerializer(source='actor', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    age = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'notification_type_display',
            'priority',
            'priority_display',
            'action_url',
            'is_read',
            'read_at',
            'actor_details',
            'age',
            'is_expired',
            'created_at',
            'expires_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'age', 'is_expired', 
            'actor_details', 'notification_type_display', 'priority_display'
        ]


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications (admin use)"""
    
    class Meta:
        model = Notification
        fields = [
            'recipient',
            'actor', 
            'notification_type',
            'title',
            'message',
            'action_url',
            'priority',
            'expires_at',
        ]


class NotificationMarkReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read/unread"""
    is_read = serializers.BooleanField()
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="List of notification IDs to update. If not provided, updates all unread notifications."
    )