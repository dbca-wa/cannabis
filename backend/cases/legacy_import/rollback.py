"""Remove exactly what a legacy import created, and nothing else."""

from collections import Counter

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from cases.models import Case, LegacySourceRecord
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

from .resolvers import IMPORT_USER_EMAIL

User = get_user_model()


def rollback_import(dry_run: bool = False) -> Counter:
    """Delete legacy cases and the records the import created for them.

    Officers, stations, defendants and botanist accounts that existed before the
    import are never touched. Records the import created are removed only when
    nothing else refers to them any more, so work entered in the app on top of
    them is preserved.
    """
    counts: Counter = Counter()
    import_user = User.objects.filter(email=IMPORT_USER_EMAIL).first()
    if import_user is None:
        return counts

    with transaction.atomic():
        cases = Case.all_objects.filter(is_legacy=True, created_by=import_user)
        counts["cases"] = cases.count()
        cases.delete()

        # Every source record was written by the import.
        records = LegacySourceRecord.objects.all()
        counts["source records"] = records.count()
        records.delete()

        defendants = Defendant.all_objects.filter(
            created_by=import_user, cases__isnull=True
        )
        counts["defendants"] = defendants.count()
        defendants.delete()

        officers = PoliceOfficer.all_objects.filter(
            created_by=import_user,
            cases_requested__isnull=True,
            cases_made__isnull=True,
        )
        counts["officers"] = officers.count()
        officers.delete()

        stations = PoliceStation.all_objects.filter(
            created_by=import_user,
            officers__isnull=True,
            case_involvement__isnull=True,
        )
        counts["stations"] = stations.count()
        stations.delete()

        botanists = User.objects.filter(
            is_legacy=True,
            is_active=False,
            role=User.RoleChoices.BOTANIST,
            email__startswith="legacy.",
            botanist_cases__isnull=True,
            finance_cases__isnull=True,
        ).exclude(pk=import_user.pk)
        counts["botanist users"] = botanists.count()
        botanists.delete()

        still_used = (
            Case.all_objects.filter(Q(created_by=import_user)).exists()
            or PoliceOfficer.all_objects.filter(created_by=import_user).exists()
            or PoliceStation.all_objects.filter(created_by=import_user).exists()
            or Defendant.all_objects.filter(created_by=import_user).exists()
        )
        if not still_used:
            import_user.delete()
            counts["import user"] = 1

        if dry_run:
            transaction.set_rollback(True)
    return counts
