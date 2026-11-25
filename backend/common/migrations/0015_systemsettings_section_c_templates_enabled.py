from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0014_systemsettings_certificate_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="section_c_templates_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, Section C templates can be chosen on a form and "
                    "managed on the Settings page. Off because Section C fills itself "
                    "from the bags and envelope; the free-text note is always shown. "
                    "Existing templates are kept while this is off."
                ),
            ),
        ),
    ]
