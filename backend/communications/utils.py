# communications/utils.py
from .models import CommentReaction


class ReactionService:
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