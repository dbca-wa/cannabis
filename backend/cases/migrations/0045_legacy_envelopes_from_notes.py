"""Replace the made-up envelope numbers on imported legacy forms.

The import filled every legacy form's security movement envelope with
"SME-<certificate number>", which was never a real envelope. The legacy system
kept the real one only in the Section C note, as "Subsamples placed into
Security Movement Envelope <number>.". Section C now prints the form's
envelope by itself, so each made-up value is replaced with the envelope the
note names, or left blank when the note names none (or more than one). Notes
are not changed.
"""

import re

from django.db import migrations

MADE_UP = re.compile(r"^SME-\d+$")
PHRASE = "subsamples placed into security movement envelope"
MAX_LENGTH = 20


def _envelope_in(note):
    found = set()
    for line in (note or "").splitlines():
        text = line.strip()
        text = text[:-1] if text.endswith(".") else text
        if text.lower().startswith(PHRASE + " "):
            value = text[len(PHRASE) :].strip()
            if value:
                found.add(value)
    if len(found) != 1:
        return ""
    value = found.pop()
    return value if len(value) <= MAX_LENGTH else ""


def replace_made_up_envelopes(apps, schema_editor):
    Priority3Form = apps.get_model("submissions", "Priority3Form")
    forms = Priority3Form.objects.filter(
        case__is_legacy=True, security_movement_envelope__startswith="SME-"
    ).only("pk", "security_movement_envelope", "additional_notes")
    for form in forms.iterator():
        if not MADE_UP.match(form.security_movement_envelope):
            continue
        Priority3Form.objects.filter(pk=form.pk).update(
            security_movement_envelope=_envelope_in(form.additional_notes)
        )


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0044_record_existing_certificate_fingerprints"),
    ]

    operations = [
        migrations.RunPython(replace_made_up_envelopes, migrations.RunPython.noop),
    ]
