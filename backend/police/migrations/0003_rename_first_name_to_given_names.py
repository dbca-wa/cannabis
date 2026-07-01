"""Rename PoliceOfficer.first_name to given_names for consistency."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("police", "0002_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="policeofficer",
            old_name="first_name",
            new_name="given_names",
        ),
    ]
