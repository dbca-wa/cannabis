"""Drop "Unknown" as a rank.

It is not a police rank. Officers who had it now have no rank recorded
(blank), which prints the same on the certificate ("Sworn Officer").
"""

from django.db import migrations, models


def clear_unknown_rank(apps, schema_editor):
    # The historical model's manager covers every row, practice ones included.
    PoliceOfficer = apps.get_model("police", "PoliceOfficer")
    PoliceOfficer.objects.filter(rank="unknown").update(rank="")


class Migration(migrations.Migration):
    dependencies = [
        ("police", "0006_remove_sworn_unsworn_ranks"),
    ]

    operations = [
        migrations.AlterField(
            model_name="policeofficer",
            name="rank",
            field=models.CharField(
                blank=True,
                choices=[
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
        # Not reversible in detail: unknown became blank.
        migrations.RunPython(clear_unknown_rank, migrations.RunPython.noop),
    ]
