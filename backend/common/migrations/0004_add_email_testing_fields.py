# Generated manually for email testing mode fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0003_add_audit_fields_to_system_settings"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="email_testing_mode",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, all emails are redirected to the test user",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="email_test_user",
            field=models.ForeignKey(
                blank=True,
                help_text="User who receives all emails when testing mode is enabled",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="email_test_settings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
