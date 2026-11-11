"""Record fingerprints for certificates made before they were tracked."""

from django.core.management.base import BaseCommand

from cases.services.certificate_service import CertificateService


class Command(BaseCommand):
    help = (
        "Give certificates without a fingerprint one, so later changes to their "
        "case show them as out of date. Safe to run more than once."
    )

    def handle(self, *args, **options):
        matched, out_of_date = CertificateService.record_existing_fingerprints()
        self.stdout.write(
            f"{matched} certificate(s) matched their case; "
            f"{out_of_date} already differed and now show as out of date."
        )
