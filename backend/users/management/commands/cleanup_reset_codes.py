"""
Management command to clean up expired and old password reset codes
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from users.services import PasswordResetCodeService


class Command(BaseCommand):
    help = 'Clean up expired and old password reset codes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No codes will be deleted')
            )
        
        try:
            if dry_run:
                # Count what would be deleted
                from users.models import PasswordResetCode
                from datetime import timedelta
                
                expired_count = PasswordResetCode.objects.filter(
                    expires_at__lt=timezone.now()
                ).count()
                
                old_used_count = PasswordResetCode.objects.filter(
                    is_used=True,
                    used_at__lt=timezone.now() - timedelta(days=7)
                ).count()
                
                total_count = expired_count + old_used_count
                
                self.stdout.write(
                    f'Would clean up {expired_count} expired codes and {old_used_count} old used codes '
                    f'(total: {total_count})'
                )
            else:
                # Actually clean up
                cleaned_count = PasswordResetCodeService.cleanup_expired_codes()
                
                if cleaned_count > 0:
                    self.stdout.write(
                        self.style.SUCCESS(f'Successfully cleaned up {cleaned_count} reset codes')
                    )
                else:
                    self.stdout.write('No reset codes needed cleanup')
                    
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error during cleanup: {str(e)}')
            )
            raise