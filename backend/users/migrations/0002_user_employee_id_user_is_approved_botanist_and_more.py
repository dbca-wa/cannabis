# Generated by Django 5.2 on 2025-04-10 00:26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='employee_id',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='is_approved_botanist',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='is_finance_officer',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='it_asset_id',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
