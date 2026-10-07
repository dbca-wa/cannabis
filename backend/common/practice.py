"""Request-scoped practice-mode context.

Practice mode is a per-user mode layered over the real application. While it is
on, the real screens operate on that user's practice data only. To make every
real query honour that without a filter at each call site, the active user and
their mode are stored on a thread-local for the duration of the request, and the
models' default manager consults it.

This context scopes reads and writes only. It is never used for authorisation.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

from django.db import models

_state = threading.local()


@dataclass(frozen=True)
class PracticeContext:
    user_id: int
    in_practice: bool


def is_in_practice_mode(user) -> bool:
    """Whether this user is currently in practice mode.

    Practice mode stays on until the user turns it off — there is no automatic
    expiry. A user's practice data persists between sessions and is only removed
    when they explicitly reset it, so returning to practice mode always shows
    their existing work rather than a purged, empty slate.
    """
    if not getattr(user, "is_authenticated", False):
        return False
    prefs = user.get_preferences
    return bool(getattr(prefs, "practice_mode", False))


def practice_started_at(user):
    """When this user's current practice session began, or None if not in one."""
    if not is_in_practice_mode(user):
        return None
    return user.get_preferences.practice_mode_started_at


def set_context(user, in_practice: bool) -> None:
    _state.context = PracticeContext(user_id=user.pk, in_practice=in_practice)


def clear_context() -> None:
    _state.context = None


def current() -> PracticeContext | None:
    """The active practice context for this request, or None outside a request."""
    return getattr(_state, "context", None)


def active_is_practice() -> bool:
    """Whether the current request is operating on practice data.

    Use this to scope related-count annotations (e.g. an officer's case count) so
    they count cases of the same kind as the entities being listed: practice
    cases in practice mode, real cases otherwise.
    """
    ctx = current()
    return bool(ctx and ctx.in_practice)


# Shared help text so every practice-capable model reads the same.
IS_PRACTICE_HELP = (
    "True for demo/practice records created in practice mode. Hidden from the "
    "live application and excluded from all real statistics."
)
PRACTICE_OWNER_HELP = (
    "The user who owns this practice record; null for real data. A user only "
    "ever sees their own practice data."
)


class RealManager(models.Manager):
    """Context-aware default manager for practice-capable models.

    Practice mode is a per-user mode layered over the real application. This
    manager makes every ``.objects`` query honour that mode without a filter at
    each call site:

    * Out of practice mode (the normal case): only real rows
      (``is_practice=False``).
    * In practice mode: only the current user's practice rows
      (``is_practice=True`` and ``practice_owner`` is that user).

    The active user and mode come from the request-scoped context above.
    Practice code, the admin and migrations use an explicit ``all_objects``
    manager to reach every row regardless of context.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        ctx = current()
        if ctx and ctx.in_practice:
            return qs.filter(is_practice=True, practice_owner_id=ctx.user_id)
        return qs.filter(is_practice=False)


def practice_owner_field(related_name):
    """A standard nullable FK marking the user who owns a practice record."""
    return models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name=related_name,
        help_text=PRACTICE_OWNER_HELP,
    )


def stamp_practice_on_create(sender, instance, **kwargs):
    """pre_save receiver: stamp new rows created while in practice mode.

    When the active request is in practice mode, any new practice-capable row is
    flagged ``is_practice`` and owned by the current user — so every create path
    (serializers, services, the shell) is covered without editing each. Rows made
    outside practice mode, and existing rows, are left untouched.
    """
    if instance.pk is not None:
        return
    if getattr(instance, "is_practice", False):
        return  # already explicitly stamped (e.g. by the practice service)
    ctx = current()
    if ctx and ctx.in_practice:
        instance.is_practice = True
        if getattr(instance, "practice_owner_id", None) is None:
            instance.practice_owner_id = ctx.user_id


def connect_practice_stamping(*model_classes):
    """Connect the stamping receiver for the given practice-capable models."""
    from django.db.models.signals import pre_save

    for model in model_classes:
        pre_save.connect(
            stamp_practice_on_create,
            sender=model,
            dispatch_uid=f"practice_stamp_{model._meta.label}",
        )
