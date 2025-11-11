from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from common.models import SystemSettings


class Command(BaseCommand):
    help = 'Test email configuration by sending a test email'

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            type=str,
            help='Email address to send test email to (defaults to system admin email)',
        )
        parser.add_argument(
            '--subject',
            type=str,
            default='Test Email from Cannabis Management System',
            help='Subject line for test email',
        )

    def handle(self, *args, **options):
        system_settings = SystemSettings.load()
        
        # Determine recipient
        to_email = options.get('to') or system_settings.forward_certificate_emails_to
        subject = options['subject']
        
        message = f"""
This is a test email from the Cannabis Management System.

Configuration:
- Email Backend: {settings.EMAIL_BACKEND}
- Email Host: {settings.EMAIL_HOST}
- Email Port: {settings.EMAIL_PORT}
- Email Use TLS: {getattr(settings, 'EMAIL_USE_TLS', False)}
- From Email: {settings.DEFAULT_FROM_EMAIL}
- Send Emails to Self: {system_settings.send_emails_to_self}
- Forward Certificate Emails To: {system_settings.forward_certificate_emails_to}

If you received this email, your email configuration is working correctly!
        """

        try:
            self.stdout.write(f"Sending test email to: {to_email}")
            self.stdout.write(f"Using backend: {settings.EMAIL_BACKEND}")
            
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[to_email],
                fail_silently=False,
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully sent test email to {to_email}')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to send test email: {str(e)}')
            )
            self.stdout.write(
                self.style.WARNING('Check your email configuration in .local.env')
            )