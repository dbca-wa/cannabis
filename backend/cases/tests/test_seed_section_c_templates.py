"""The seed_section_c_templates command.

Creates the standard Section C note templates by name, idempotently.
"""

import pytest
from django.core.management import call_command

from cases.models import SectionCTemplate

pytestmark = pytest.mark.django_db


def test_seeds_the_named_templates():
    call_command("seed_section_c_templates")
    names = set(SectionCTemplate.objects.values_list("name", flat=True))
    assert {"Female Plants", "SME Number"} <= names


def test_female_plants_template_lists_bags_without_the_word_numbers():
    call_command("seed_section_c_templates")
    female = SectionCTemplate.objects.get(name="Female Plants")
    # Uses the ready-made sentence variable, which renders as prose and never
    # contains the word "numbers".
    assert "{{female_plant_sentence}}" in female.content
    assert "numbers" not in female.content.lower()


def test_sme_number_template_references_the_envelope():
    call_command("seed_section_c_templates")
    sme = SectionCTemplate.objects.get(name="SME Number")
    assert "{{security_movement_envelope}}" in sme.content
    assert sme.content.startswith("Subsamples placed into Security Movement Envelope")


def test_is_idempotent():
    call_command("seed_section_c_templates")
    call_command("seed_section_c_templates")
    assert SectionCTemplate.objects.filter(name="Female Plants").count() == 1
    assert SectionCTemplate.objects.filter(name="SME Number").count() == 1
