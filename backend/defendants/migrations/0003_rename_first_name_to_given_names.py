# Generated manually — RenameField preserves data.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("defendants", "0002_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="defendant",
            old_name="first_name",
            new_name="given_names",
        ),
    ]
