"""Staff accounts: the DBCA directory, invitations and former-botanist accounts.

Staff join by invitation. An admin picks a person from the DBCA staff
directory (IT Assets), the app emails them a link, and accepting it creates
the account under their real email.

The legacy import records each old certificate's botanist. A botanist with no
account in the app gets an inactive placeholder account (``is_legacy``, no
password, a ``legacy.`` email) so their past cases have someone to point at.
When that person is later invited as a botanist, accepting the invitation turns
the placeholder into their real account instead of creating a second one, so
their past cases stay with them.
"""

import secrets
from dataclasses import dataclass, field
from datetime import timedelta
from typing import List, Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from common.logging import describe_user

User = get_user_model()

DIRECTORY_CACHE_KEY = "it_assets_all_users"
DIRECTORY_CACHE_TTL = 300  # seconds
INVITATION_LIFETIME = timedelta(hours=24)


class DirectoryUnavailable(Exception):
    """The DBCA staff directory could not be reached."""


# ---------------------------------------------------------------- directory
def fetch_directory_users() -> List[dict]:
    """Every person in the DBCA staff directory, cached for five minutes."""
    import requests
    from django.core.cache import cache

    people = cache.get(DIRECTORY_CACHE_KEY)
    if people is None:
        try:
            response = requests.get(
                settings.IT_ASSETS_URLS,
                auth=(settings.IT_ASSETS_USER, settings.IT_ASSETS_ACCESS_TOKEN),
                timeout=15,
            )
            response.raise_for_status()
            people = response.json()
        except requests.RequestException as exc:
            settings.LOGGER.error(f"IT Assets API error: {exc}")
            raise
        cache.set(DIRECTORY_CACHE_KEY, people, DIRECTORY_CACHE_TTL)
    return people


def directory_person(record: dict) -> dict:
    """A directory record in the shape invitations store and the UI shows."""
    given = record.get("given_name", "") or ""
    surname = record.get("surname", "") or ""
    name = record.get("name", "") or ""
    full_name = f"{given} {surname}".strip() or name
    return {
        "id": record.get("id"),
        "employee_id": record.get("employee_id"),
        "given_name": given or name.split(" ")[0],
        "surname": surname or " ".join(name.split(" ")[1:]),
        "email": (record.get("email", "") or "").lower(),
        "full_name": full_name,
        "title": record.get("title"),
        "division": record.get("division"),
        "unit": record.get("unit"),
    }


def find_directory_person(email: str) -> Optional[dict]:
    """The directory entry for an email address, or None."""
    import requests

    try:
        people = fetch_directory_users()
    except requests.RequestException as exc:
        raise DirectoryUnavailable(str(exc)) from exc
    email = email.strip().lower()
    for record in people:
        if (record.get("email", "") or "").lower() == email:
            return directory_person(record)
    return None


# ------------------------------------------------- former-botanist accounts
def is_placeholder(user) -> bool:
    """True for an account the legacy import made for a former botanist.

    Placeholders have never been signed into: inactive, legacy, no usable
    password, and not an administrator.
    """
    return (
        user.is_legacy
        and not user.is_active
        and not user.is_staff
        and not user.is_superuser
        and not user.has_usable_password()
    )


def find_placeholder(given_names: str, last_name: str):
    """The one placeholder account with this person's name, or None.

    Names match as the import matches them (word order, initials and titles
    ignored). Two placeholders with the same name are ambiguous, so neither is
    returned and a new account is made instead.
    """
    from cases.legacy_import.names import person_key

    key = person_key(given_names, last_name)
    if not key:
        return None
    matches = [
        user
        for user in User.objects.filter(is_legacy=True, is_active=False)
        if person_key(user.given_names, user.last_name) == key and is_placeholder(user)
    ]
    return matches[0] if len(matches) == 1 else None


def claim_placeholder(placeholder, email: str, person: dict):
    """Turn a placeholder into the real person's account, keeping its cases.

    The account keeps its id, so every past case that names it now names the
    real person. It stays inactive until the invitation is accepted.
    """
    old_email = placeholder.email
    placeholder.email = email
    placeholder.given_names = person.get("given_name") or placeholder.given_names
    placeholder.last_name = person.get("surname") or placeholder.last_name
    placeholder.employee_id = person.get("employee_id")
    placeholder.it_asset_id = person.get("id")
    placeholder.is_legacy = False
    placeholder.save()
    settings.LOGGER.info(
        f"Linked former-botanist account {old_email} ({placeholder.pk}) to {email}"
    )
    return placeholder


# ---------------------------------------------------------------- invitations
def send_invitation(
    person: dict, role: str, is_staff: bool, invited_by, send_email=True
):
    """Create an invitation for a directory person and email the link.

    Returns ``(invite_record, activation_link, recipients)``. With
    ``send_email`` off nothing is sent; the caller passes the link on. If
    sending fails the invitation is removed and the error raised.
    """
    from common.models import SystemSettings
    from common.services import EmailService
    from common.utils import get_frontend_url

    from ..models import InviteRecord

    email = person["email"]
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + INVITATION_LIFETIME
    invite = InviteRecord.objects.create(
        email=email,
        invited_by=invited_by,
        role=role,
        token=token,
        expires_at=expires_at,
        external_user_data=person,
        is_staff=bool(is_staff),
    )
    # No trailing slash, matching the SPA route /auth/activate-invite/:token.
    link = get_frontend_url(f"/auth/activate-invite/{token}")
    recipients: List[str] = []
    if send_email:
        system_settings = SystemSettings.load()
        recipients = (
            [system_settings.forward_certificate_emails_to]
            if system_settings.send_emails_to_self
            else [email]
        )
        try:
            EmailService.send_template_email(
                template_name="emails/invitation_email.html",
                recipient_email=recipients,
                subject="Invitation to Cannabis Management System",
                context={
                    "recipient_given_names": person.get("given_name") or "there",
                    "inviter_given_names": invited_by.given_names,
                    "inviter_last_name": invited_by.last_name,
                    "inviter_email": invited_by.email,
                    "invitee_proposed_role": dict(User.RoleChoices.choices).get(
                        role, "None"
                    ),
                    "invitation_link": link,
                    "expires_at": expires_at,
                },
            )
        except Exception:
            invite.delete()
            raise
    redirected = (
        f" (sent to {recipients[0]} instead)"
        if recipients and recipients != [email]
        else ("" if send_email else " (not emailed)")
    )
    settings.LOGGER.info(
        f"{describe_user(invited_by)} invited {email} as {role} "
        f"(invitation {invite.pk}){redirected}"
    )
    return invite, link, recipients


# ---------------------------------------------------------------- provisioning
FLAGS = ("admin", "superuser", "maintainer")


@dataclass
class StaffSpec:
    """One person to give an account: ``email:role[:flags[:Given Names Surname]]``.

    Flags: ``admin`` (app administrator), ``superuser`` (Django admin) and
    ``maintainer`` (can run the legacy import). The name is only used when the
    DBCA directory cannot be reached or does not list the person; the last
    word is the surname.
    """

    email: str
    role: str
    flags: List[str] = field(default_factory=list)
    name: str = ""

    @classmethod
    def parse(cls, text: str) -> "StaffSpec":
        parts = text.strip().split(":")
        if len(parts) not in (2, 3, 4) or "@" not in parts[0]:
            raise ValueError(
                f"'{text}' is not email:role, email:role:flags or "
                "email:role:flags:Name"
            )
        email, role = parts[0].strip().lower(), parts[1].strip()
        roles = [choice for choice, _ in User.RoleChoices.choices]
        if role not in roles:
            raise ValueError(f"'{role}' is not a role; use one of {', '.join(roles)}")
        flags = (
            [f.strip() for f in parts[2].split(",") if f.strip()]
            if len(parts) >= 3
            else []
        )
        unknown = [f for f in flags if f not in FLAGS]
        if unknown:
            raise ValueError(
                f"Unknown flag(s) {', '.join(unknown)}; use {', '.join(FLAGS)}"
            )
        name = parts[3].strip() if len(parts) == 4 else ""
        return cls(email, role, flags, name)


@dataclass
class ProvisionResult:
    email: str
    outcome: str
    detail: str = ""
    link: Optional[str] = None


def person_from_name(email: str, name: str) -> Optional[dict]:
    """A directory-shaped person from a typed name; the last word is the surname."""
    words = name.split()
    if not words:
        return None
    given, surname = " ".join(words[:-1]), words[-1]
    return {
        "id": None,
        "employee_id": None,
        "given_name": given,
        "surname": surname,
        "email": email,
        "full_name": name.strip(),
    }


def resolve_people(specs):
    """Each person's details, from the directory or else their typed name.

    Returns ``(people, problems, directory_reachable)``: ``people`` maps email
    to details, ``problems`` lists the people who could not be resolved.
    """
    people, problems, reachable = {}, [], True
    for spec in specs:
        person = None
        if reachable:
            try:
                person = find_directory_person(spec.email)
            except DirectoryUnavailable:
                reachable = False
        if person is None and spec.name:
            person = person_from_name(spec.email, spec.name)
        if person is None:
            problems.append(
                f"{spec.email}: not in the DBCA directory and no name given"
                if reachable
                else f"{spec.email}: the DBCA directory is unavailable; add the name"
            )
        else:
            people[spec.email] = person
    return people, problems, reachable


def provision_staff(specs, invited_by, send_email=True) -> List[ProvisionResult]:
    """Make sure each listed person has an account, and invite them.

    - Someone who can already sign in is left as they are.
    - Someone with a pending invitation is not invited again.
    - Otherwise their account is prepared (an existing inactive account with
      their email, the former-botanist placeholder with their name when they
      are a botanist, or a new account), given the role and flags, and they
      are invited. Accepting the invitation activates it and sets a password.

    Names come from the DBCA directory, as for an invitation from the app, or
    from the name given with the person when the directory cannot help.
    """
    from ..models import InviteRecord

    results: List[ProvisionResult] = []
    todo = []
    for spec in specs:
        if User.objects.filter(email__iexact=spec.email, is_active=True).exists():
            results.append(ProvisionResult(spec.email, "already has an account"))
            continue
        pending = InviteRecord.objects.filter(
            email__iexact=spec.email,
            is_valid=True,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).exists()
        if pending:
            results.append(ProvisionResult(spec.email, "already invited"))
            continue
        todo.append(spec)

    people, problems, reachable = resolve_people(todo)
    for spec in todo:
        person = people.get(spec.email)
        if person is None:
            results.append(
                ProvisionResult(
                    spec.email,
                    (
                        "not in the DBCA directory"
                        if reachable
                        else "directory unavailable"
                    ),
                    "not invited; add their name to the entry",
                )
            )
            continue

        notes = (
            []
            if person.get("id")
            else ["name as typed; the directory did not supply it"]
        )
        account = User.objects.filter(email__iexact=spec.email, is_active=False).first()
        if account is None and spec.role == User.RoleChoices.BOTANIST:
            placeholder = find_placeholder(person["given_name"], person["surname"])
            if placeholder is not None:
                cases = placeholder.botanist_cases.count()
                account = claim_placeholder(placeholder, spec.email, person)
                notes.append(
                    f"linked to their former-botanist account ({cases} past cases)"
                )
        if account is None:
            account = User(email=spec.email, is_active=False)
            account.set_unusable_password()
        account.given_names = person["given_name"]
        account.last_name = person["surname"]
        account.employee_id = person.get("employee_id")
        account.it_asset_id = person.get("id")
        account.role = spec.role
        account.is_legacy = False
        account.is_staff = "admin" in spec.flags
        account.is_superuser = "superuser" in spec.flags
        account.is_maintainer = "maintainer" in spec.flags
        account.invited_by = invited_by
        account.save()

        _, link, recipients = send_invitation(
            person, spec.role, "admin" in spec.flags, invited_by, send_email
        )
        notes.append(f"emailed to {recipients[0]}" if recipients else "not emailed")
        results.append(ProvisionResult(spec.email, "invited", "; ".join(notes), link))
    return results
