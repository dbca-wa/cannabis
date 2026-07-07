"""
Common test data factories using factory_boy.

Provides factories for creating test data across the backend apps. The cases app
is registered under the ``submissions`` label (db tables ``submissions_*``), so
its factory model strings use that label.
"""

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory


# ============================================================================
# Users
# ============================================================================
class UserFactory(DjangoModelFactory):
    """A roleless, active user (email is the username field)."""

    class Meta:
        model = "users.User"
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    given_names = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    role = "none"
    is_active = True
    is_staff = False
    is_superuser = False

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        """Set a usable password after creation."""
        if create:
            obj.set_password(extracted or "testpass123")
            obj.save()


class BotanistFactory(UserFactory):
    """A user with the botanist role."""

    email = factory.Sequence(lambda n: f"botanist{n}@example.com")
    role = "botanist"


class FinanceFactory(UserFactory):
    """A user with the finance role."""

    email = factory.Sequence(lambda n: f"finance{n}@example.com")
    role = "finance"


class SuperuserFactory(UserFactory):
    """An admin (staff + superuser)."""

    email = factory.Sequence(lambda n: f"admin{n}@example.com")
    is_staff = True
    is_superuser = True


# ============================================================================
# Police
# ============================================================================
class PoliceStationFactory(DjangoModelFactory):
    class Meta:
        model = "police.PoliceStation"
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Station {n}")


class PoliceOfficerFactory(DjangoModelFactory):
    class Meta:
        model = "police.PoliceOfficer"
        skip_postgeneration_save = True

    given_names = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    badge_number = factory.Sequence(lambda n: f"PD{n:05d}")
    station = factory.SubFactory(PoliceStationFactory)


# ============================================================================
# Defendants
# ============================================================================
class DefendantFactory(DjangoModelFactory):
    class Meta:
        model = "defendants.Defendant"
        skip_postgeneration_save = True

    given_names = factory.Faker("first_name")
    last_name = factory.Faker("last_name")


# ============================================================================
# Cases (app label: submissions)
# ============================================================================
class CaseFactory(DjangoModelFactory):
    class Meta:
        model = "submissions.Case"
        skip_postgeneration_save = True
        exclude = ["phase", "security_movement_envelope"]

    case_number = factory.Sequence(lambda n: f"CANN{n:05d}")
    received = factory.LazyFunction(timezone.now)
    # Legacy params accepted but not passed to model (phase is now on Priority3Form)
    phase = "assessment"
    security_movement_envelope = ""


class Priority3FormFactory(DjangoModelFactory):
    class Meta:
        model = "submissions.Priority3Form"
        skip_postgeneration_save = True

    case = factory.SubFactory(CaseFactory)
    phase = "assessment"
    security_movement_envelope = factory.Sequence(lambda n: f"SME{n:05d}")


class DrugBagFactory(DjangoModelFactory):
    class Meta:
        model = "submissions.DrugBag"
        skip_postgeneration_save = True

    form = factory.SubFactory(Priority3FormFactory)
    content_type = "plant"
    seal_tag_numbers = factory.Sequence(lambda n: f"TAG{n:06d}")


class BotanicalAssessmentFactory(DjangoModelFactory):
    class Meta:
        model = "submissions.BotanicalAssessment"
        skip_postgeneration_save = True

    drug_bag = factory.SubFactory(DrugBagFactory)
    determination = "cannabis_sativa"
    assessment_date = factory.LazyFunction(timezone.now)


class CertificateFactory(DjangoModelFactory):
    class Meta:
        model = "submissions.Certificate"
        skip_postgeneration_save = True

    form = factory.SubFactory(Priority3FormFactory)
    certified_date = factory.LazyFunction(lambda: timezone.now().date())

    @factory.post_generation
    def bags(obj, create, extracted, **kwargs):
        """Attach drug bags to the certificate (max 5 enforced in the service)."""
        if not create:
            return
        if extracted:
            obj.bags.set(extracted)
