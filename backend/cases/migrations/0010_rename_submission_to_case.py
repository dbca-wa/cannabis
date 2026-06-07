"""
Rename Submission → Case, SubmissionDraft → CaseDraft,
SubmissionPhaseHistory → CasePhaseHistory.

The app directory stays as `submissions/` — only model class names change.
DrugBag.submission FK field name is NOT renamed (minimise churn).
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0009_remove_submission_is_draft"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Submission",
            new_name="Case",
        ),
        migrations.RenameModel(
            old_name="SubmissionDraft",
            new_name="CaseDraft",
        ),
        migrations.RenameModel(
            old_name="SubmissionPhaseHistory",
            new_name="CasePhaseHistory",
        ),
        # Set explicit db_table so the physical table name is predictable
        migrations.AlterModelTable(
            name="case",
            table="submissions_case",
        ),
        migrations.AlterModelTable(
            name="casedraft",
            table="submissions_casedraft",
        ),
        migrations.AlterModelTable(
            name="casephasehistory",
            table="submissions_casephasehistory",
        ),
    ]
