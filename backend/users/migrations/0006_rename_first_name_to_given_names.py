"""Rename User.first_name to given_names for consistency."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_delete_refreshtoken"),
    ]

    operations = [
        migrations.RenameField(
            model_name="user",
            old_name="first_name",
            new_name="given_names",
        ),
    ]
