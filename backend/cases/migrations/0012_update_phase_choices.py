"""
Migration to update Case phase choices to the new 7-phase state machine
and mark all existing cases as complete.

New phases: assessment, data_entry, unsigned_generation, botanist_signoff,
            invoicing, send_emails, complete

Removed: finance_approval, botanist_review, documents
"""

from django.db import migrations, models


def migrate_existing_phases_forward(apps, schema_editor):
    """
    Set all existing cases to 'complete' phase.

    Rationale: All existing cases were processed under the old workflow.
    Rather than guessing which new phase they belong in, mark all as
    complete. New cases created after this migration start at 'assessment'.
    """
    Case = apps.get_model("submissions", "Case")
    Case.objects.all().update(phase="complete")


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0011_alter_case_options_alter_casedraft_options_and_more"),
    ]

    operations = [
        # 1. Update phase field to accept new choices and new default
        migrations.AlterField(
            model_name="case",
            name="phase",
            field=models.CharField(
                choices=[
                    ("assessment", "Awaiting Assessment"),
                    ("data_entry", "Awaiting Data Entry"),
                    ("unsigned_generation", "Awaiting Unsigned Cert"),
                    ("botanist_signoff", "Awaiting Signature"),
                    ("invoicing", "Awaiting Invoice"),
                    ("send_emails", "Awaiting Email"),
                    ("complete", "Complete"),
                ],
                default="assessment",
                help_text="Current phase of the case workflow",
                max_length=30,
            ),
        ),
        # 2. Migrate all existing data to 'complete'
        migrations.RunPython(
            migrate_existing_phases_forward,
            migrations.RunPython.noop,
        ),
    ]
