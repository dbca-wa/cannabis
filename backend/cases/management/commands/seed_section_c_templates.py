"""Seed the standard Section C note templates.

Creates (or updates) the reusable Section C templates used in the certificate
workflow. Idempotent: matching is by the unique template name, so re-running
refreshes each template's content rather than creating duplicates.

Usage:
    poetry run python manage.py seed_section_c_templates

The template bodies use {{variable}} placeholders resolved against the form's
data when a template is applied. Available placeholders include
security_movement_envelope, female_plant_sentence, female_bag_label,
female_plant_tags, tag_numbers, new_tag_numbers, defendant_name and others.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import SectionCTemplate

# Each template is (name, content). Names are unique and used for matching.
TEMPLATES = [
    (
        "SME",
        "Subsamples placed into Security Movement Envelope "
        "{{security_movement_envelope}}.",
    ),
    (
        "SME + Female",
        "Subsamples placed into Security Movement Envelope "
        "{{security_movement_envelope}}.\n{{female_plant_sentence}}",
    ),
]


class Command(BaseCommand):
    help = "Create or update the standard Section C note templates (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for name, content in TEMPLATES:
            _obj, created = SectionCTemplate.objects.update_or_create(
                name=name,
                defaults={"content": content},
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created template: {name}"))
            else:
                updated_count += 1
                self.stdout.write(f"Updated template: {name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created_count} created, {updated_count} updated, "
                f"{len(TEMPLATES)} total."
            )
        )
