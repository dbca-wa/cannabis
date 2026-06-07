# Enables the pg_trgm PostgreSQL extension for trigram similarity queries.
# Required by the OCR entity matcher for fuzzy matching against officer,
# station, and defendant records.

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0006_certificate_is_locked_certificate_locked_at_and_more"),
    ]

    operations = [
        TrigramExtension(),
    ]
