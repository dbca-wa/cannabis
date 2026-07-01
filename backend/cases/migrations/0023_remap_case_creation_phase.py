"""Data migration: 'case_creation' is no longer a workflow state.

Any case still sitting in the removed `case_creation` phase is moved to
`assessment` (the new first state). Case creation is now a process, not a state.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    Case = apps.get_model("submissions", "Case")
    Case.objects.filter(phase="case_creation").update(phase="assessment")


def backwards(apps, schema_editor):
    # Not reversible — the original case_creation rows cannot be distinguished.
    pass


class Migration(migrations.Migration):

    dependencies = [
        (
            "submissions",
            "0022_alter_case_phase_alter_casephasehistory_from_phase_and_more",
        ),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
