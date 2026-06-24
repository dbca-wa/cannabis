"""
Data migration: Transition from data_entry phase to new phase structure.

- Cases in 'data_entry' phase move to 'assessment' (they've already been created)
- CasePhaseHistory records referencing 'data_entry' update to 'case_creation'
  (data_entry was the initial entry phase, now replaced by case_creation)
"""

from django.db import migrations


def migrate_phases_forward(apps, schema_editor):
    """
    Forward migration:
    1. Cases with phase='data_entry' → 'assessment'
    2. CasePhaseHistory from_phase/to_phase 'data_entry' → 'case_creation'
    """
    Case = apps.get_model("submissions", "Case")
    CasePhaseHistory = apps.get_model("submissions", "CasePhaseHistory")

    # Cases in data_entry have already been created, so they belong in assessment
    Case.objects.filter(phase="data_entry").update(phase="assessment")

    # History records: data_entry was the initial entry phase, now case_creation
    CasePhaseHistory.objects.filter(from_phase="data_entry").update(
        from_phase="case_creation"
    )
    CasePhaseHistory.objects.filter(to_phase="data_entry").update(
        to_phase="case_creation"
    )


def migrate_phases_reverse(apps, schema_editor):
    """
    Reverse migration:
    1. Cases with phase='case_creation' → 'data_entry'
    2. CasePhaseHistory from_phase/to_phase 'case_creation' → 'data_entry'

    Note: Cases moved from data_entry to assessment cannot be perfectly reversed,
    but we restore case_creation references back to data_entry.
    """
    Case = apps.get_model("submissions", "Case")
    CasePhaseHistory = apps.get_model("submissions", "CasePhaseHistory")

    # Reverse: case_creation back to data_entry
    Case.objects.filter(phase="case_creation").update(phase="data_entry")

    CasePhaseHistory.objects.filter(from_phase="case_creation").update(
        from_phase="data_entry"
    )
    CasePhaseHistory.objects.filter(to_phase="case_creation").update(
        to_phase="data_entry"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0014_update_phase_to_case_creation"),
    ]

    operations = [
        migrations.RunPython(
            migrate_phases_forward,
            migrate_phases_reverse,
        ),
    ]
