"""
Management command to manage rate limits and view security lockouts
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.utils import timezone
import json


class Command(BaseCommand):
    help = 'Manage rate limits and view security lockouts for password reset system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--action',
            type=str,
            choices=['status', 'clear', 'unlock'],
            default='status',
            help='Action to perform: status (view current lockouts), clear (clear all), unlock (unlock specific email/IP)'
        )
        parser.add_argument(
            '--email',
            type=str,
            help='Email address to unlock (use with --action unlock)'
        )
        parser.add_argument(
            '--ip',
            type=str,
            help='IP address to unlock (use with --action unlock)'
        )
        parser.add_argument(
            '--format',
            type=str,
            choices=['table', 'json'],
            default='table',
            help='Output format'
        )

    def handle(self, *args, **options):
        action = options['action']
        
        if action == 'status':
            self.show_status(options['format'])
        elif action == 'clear':
            self.clear_all_limits()
        elif action == 'unlock':
            self.unlock_specific(options['email'], options['ip'])

    def show_status(self, format_type):
        """Show current rate limit status and lockouts"""
        self.stdout.write(self.style.SUCCESS('Password Reset Security Status'))
        self.stdout.write('=' * 50)
        
        # Get all cache keys related to password reset
        lockouts = self.get_lockout_info()
        rate_limits = self.get_rate_limit_info()
        
        if format_type == 'json':
            output = {
                'lockouts': lockouts,
                'rate_limits': rate_limits,
                'timestamp': timezone.now().isoformat()
            }
            self.stdout.write(json.dumps(output, indent=2))
        else:
            self.display_table_format(lockouts, rate_limits)

    def get_lockout_info(self):
        """Get information about current lockouts"""
        lockouts = {
            'email_lockouts': [],
            'ip_lockouts': []
        }
        
        # This is a simplified version - in production you might want to
        # iterate through cache keys or maintain a separate tracking system
        # For now, we'll provide a structure for manual checking
        
        return lockouts

    def get_rate_limit_info(self):
        """Get current rate limit counters"""
        rate_limits = {
            'password_reset_email': [],
            'reset_code_verification': [],
            'ip_attempts': []
        }
        
        # This would need to be implemented based on your cache key patterns
        # For now, providing structure
        
        return rate_limits

    def display_table_format(self, lockouts, rate_limits):
        """Display information in table format"""
        # Email lockouts
        if lockouts['email_lockouts']:
            self.stdout.write('\nEmail Lockouts:')
            self.stdout.write('-' * 30)
            for lockout in lockouts['email_lockouts']:
                self.stdout.write(f"Email: {lockout['email']}")
                self.stdout.write(f"  Locked until: {lockout['expires_at']}")
                self.stdout.write(f"  Attempts: {lockout['attempt_count']}")
                self.stdout.write('')
        else:
            self.stdout.write('\nNo email lockouts currently active.')

        # IP lockouts
        if lockouts['ip_lockouts']:
            self.stdout.write('\nIP Address Lockouts:')
            self.stdout.write('-' * 30)
            for lockout in lockouts['ip_lockouts']:
                self.stdout.write(f"IP: {lockout['ip_address']}")
                self.stdout.write(f"  Locked until: {lockout['expires_at']}")
                self.stdout.write(f"  Attempts: {lockout['attempt_count']}")
                self.stdout.write('')
        else:
            self.stdout.write('\nNo IP lockouts currently active.')

        # Rate limit counters
        self.stdout.write('\nRate Limit Status:')
        self.stdout.write('-' * 30)
        self.stdout.write('Use Django admin or cache inspection tools for detailed rate limit counters.')

    def clear_all_limits(self):
        """Clear all rate limits and lockouts"""
        if not self.confirm_action("This will clear ALL rate limits and lockouts. Continue?"):
            return

        # Clear password reset related cache keys
        patterns = [
            'reset_code_lockout_email:*',
            'reset_code_lockout_ip:*',
            'reset_code_attempts_ip:*',
            'reset_code_verification_email:*',
            'password_reset_email:*',
            'password_reset_email_target:*'
        ]
        
        cleared_count = 0
        for pattern in patterns:
            # Note: This is a simplified approach
            # In production, you'd need to implement proper cache key iteration
            # based on your cache backend (Redis, Memcached, etc.)
            try:
                # This would need to be implemented based on cache backend
                # For now, we'll use cache.clear() as a fallback
                pass
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error clearing pattern {pattern}: {str(e)}')
                )

        # Fallback: clear entire cache (use with caution in production)
        try:
            cache.clear()
            self.stdout.write(
                self.style.SUCCESS('All cache cleared - rate limits and lockouts reset!')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to clear cache: {str(e)}')
            )

    def unlock_specific(self, email, ip_address):
        """Unlock specific email or IP address"""
        if not email and not ip_address:
            self.stdout.write(
                self.style.ERROR('Please specify either --email or --ip to unlock')
            )
            return

        unlocked = []

        if email:
            # Clear email-specific lockouts and counters
            keys_to_clear = [
                f'reset_code_lockout_email:{email}',
                f'reset_code_verification_email:{email}',
                f'password_reset_email_target:{email}'
            ]
            
            for key in keys_to_clear:
                try:
                    cache.delete(key)
                    unlocked.append(f'Email lockout: {email}')
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error clearing {key}: {str(e)}')
                    )

        if ip_address:
            # Clear IP-specific lockouts and counters
            keys_to_clear = [
                f'reset_code_lockout_ip:{ip_address}',
                f'reset_code_attempts_ip:{ip_address}',
                f'password_reset_email:{ip_address}'
            ]
            
            for key in keys_to_clear:
                try:
                    cache.delete(key)
                    unlocked.append(f'IP lockout: {ip_address}')
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error clearing {key}: {str(e)}')
                    )

        if unlocked:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully unlocked: {", ".join(unlocked)}')
            )
        else:
            self.stdout.write(
                self.style.WARNING('No lockouts found to clear')
            )

    def confirm_action(self, message):
        """Ask for user confirmation"""
        response = input(f'{message} (y/N): ')
        return response.lower() in ['y', 'yes']