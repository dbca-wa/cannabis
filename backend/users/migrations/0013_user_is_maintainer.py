"""Add the maintainer flag and give it to the app's maintainer.

Maintainers can run system tasks, such as the legacy data import, from the
Settings page. Other maintainers are added in Django admin.
"""

from django.db import migrations, models

MAINTAINER_EMAIL = "jarid.prince@dbca.wa.gov.au"


def grant_maintainer(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(email__iexact=MAINTAINER_EMAIL).update(is_maintainer=True)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_practice_started_help_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_maintainer",
            field=models.BooleanField(
                default=False,
                help_text="Maintainers can run system tasks such as the legacy data import from the Settings page.",
            ),
        ),
        migrations.RunPython(grant_maintainer, migrations.RunPython.noop),
    ]
