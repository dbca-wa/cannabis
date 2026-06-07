"""Verification of parser output against the sample PDF fixture."""

import os
import sys

import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from dataclasses import asdict  # noqa: E402

from cases.ocr.client import TesseractOcrClient  # noqa: E402
from cases.ocr.parser import PoliceFormParser  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "Police form sample.pdf")

with open(FIXTURE, "rb") as f:
    data = f.read()

client = TesseractOcrClient()
text = client.extract_text(data, "application/pdf")
confs = client.extract_with_confidence(data, "application/pdf")

parser = PoliceFormParser()
result = asdict(parser.parse(text, confs))

print("=== EXTRACTION RESULTS ===")
for key in [
    "date",
    "seizure_date",
    "security_movement_envelope",
    "defendant_name",
    "division_unit",
]:
    f = result[key]
    print(f"  {key}: value={f['value']!r}, conf={f['confidence']:.2f}")

co = result["conveying_officer"]
print(
    f"  conveying: name={co['name']['value']!r},"
    f" badge={co['badge_number']['value']!r}"
)

ob = result["on_behalf_of_officer"]
print(
    f"  on_behalf: name={ob['name']['value']!r},"
    f" badge={ob['badge_number']['value']!r}"
)

print(f"  items: {len(result['items'])} rows")
for i, item in enumerate(result["items"]):
    print(
        f"    [{i}] ref={item['property_reference']['value']!r}"
        f" qty={item['quantity']['value']}"
        f" type={item['mapped_content_type']}"
        f" seal={item['seal_number']['value']!r}"
        f" new_seal={item['new_seal_number']['value']!r}"
    )
