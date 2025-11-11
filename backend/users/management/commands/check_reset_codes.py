from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import PasswordResetCode
from django.utils import timezone

User = get_user_model()

class Command(BaseCommand):
    help = 'Check password reset codes for a user'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='User email to check')
        parser.add_argument('--clear', action='store_true', help='Clear existing codes')

    def handle(self, *args, **options):
        email = options['email']
        
        try:
            user = User.objects.get(email=email)
            self.stdout.write(f'User found: {user.email}')
            self.stdout.write(f'Password last changed: {user.password_last_changed}')
            
            if user.password_last_changed:
                time_since_change = timezone.now() - user.password_last_changed
                self.stdout.write(f'Time since change: {time_since_change}')
                
            codes = PasswordResetCode.objects.filter(user=user)
            self.stdout.write(f'Found {codes.count()} reset codes:')
            
            for code in codes:
                self.stdout.write(f'  Code ID: {code.id}')
                self.stdout.write(f'  Created: {code.created_at}')
                self.stdout.write(f'  Expires: {code.expires_at}')
                self.stdout.write(f'  Used: {code.is_used}')
                self.stdout.write(f'  Attempts: {code.attempts}')
                self.stdout.write(f'  Is expired: {code.is_expired}')
                self.stdout.write('  ---')
                
            if options['clear']:
                deleted_count = codes.delete()[0]
                self.stdout.write(f'Deleted {deleted_count} reset codes')
                
        except User.DoesNotExist:
            self.stdout.write(f'User not found: {email}')