"""Drop "Sworn Officer" and "Unsworn Officer" as ranks.

They are not police ranks: the certificate prints them by role. Officers who
had them now have no rank recorded (blank), which prints the same.
"""

from django.db import migrations, models

LEGACY_LABELS = ("sworn_officer", "unsworn_officer")


def clear_legacy_ranks(apps, schema_editor):
    # The historical model's manager covers every row, practice ones included.
    PoliceOfficer = apps.get_model("police", "PoliceOfficer")
    PoliceOfficer.objects.filter(rank__in=LEGACY_LABELS).update(rank="")


class Migration(migrations.Migration):

    dependencies = [
        ("police", "0005_policeofficer_is_practice_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="policeofficer",
            name="rank",
            field=models.CharField(
                blank=True,
                choices=[
                    ("unknown", "Unknown"),
                    ("constable", "Constable"),
                    ("police_constable", "Police Constable"),
                    ("first_class_constable", "First Class Constable"),
                    ("senior_constable", "Senior Constable"),
                    ("detective", "Detective"),
                    (
                        "detective_first_class_constable",
                        "Detective First Class Constable",
                    ),
                    ("detective_senior_constable", "Detective Senior Constable"),
                    ("senior_detective", "Senior Detective"),
                    ("sergeant", "Sergeant"),
                    ("inspector", "Inspector"),
                    ("other", "Other"),
                ],
                default="",
                help_text="The officer's police rank. Blank when none is recorded.",
                max_length=50,
            ),
        ),
        # Not reversible in detail: sworn and unsworn both became blank.
        migrations.RunPython(clear_legacy_ranks, migrations.RunPython.noop),
    ]
