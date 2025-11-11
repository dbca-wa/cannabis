"""
Management command to reset rate limits by clearing the cache
"""

from django.core.management.base import BaseCommand
from django.core.cache import cache


class Command(BaseCommand):
    help = 'Reset rate limits by clearing the cache'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm the cache clear operation',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will clear all cached data including rate limits.\n'
                    'Use --confirm to proceed.'
                )
            )
            return

        try:
            cache.clear()
            self.stdout.write(
                self.style.SUCCESS(
                    'Successfully cleared cache - all rate limits have been reset!'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to clear cache: {e}')
            )