from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0008_submissiondraft"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="submission",
            name="is_draft",
        ),
    ]
