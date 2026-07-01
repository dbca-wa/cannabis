"""Drop the removed communications app tables.

The internal comments, comment reactions, and notification features were removed
(the only system communications are the invitation and password-reset emails).
This drops their tables in every environment and clears the orphaned migration
history rows for the removed ``communications`` app.
"""

from django.db import migrations

DROP_SQL = """
DROP TABLE IF EXISTS communications_commentreaction CASCADE;
DROP TABLE IF EXISTS communications_submissioncomment CASCADE;
DROP TABLE IF EXISTS communications_notification CASCADE;
DELETE FROM django_migrations WHERE app = 'communications';
"""


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0008_remove_systemsettings_call_out_fee_and_more"),
    ]

    operations = [
        # Irreversible: the communications feature has been removed.
        migrations.RunSQL(sql=DROP_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
