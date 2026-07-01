"""Workflow service — phase transition business logic.

Handles the 5-phase case state machine:
  assessment → unsigned_generation → batching → in_batch → complete

There is no "send back" action; cases only move forward. The transition from
batching → in_batch happens when a case is added to a batch. The transition from
in_batch → complete is driven by BatchService when an invoice-raised number is
recorded on the batch, not by a manual advance.
"""

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from ..models import Case, CasePhaseHistory

# Ordered phase sequence for transition validation
PHASE_ORDER = [
    Case.PhaseChoices.ASSESSMENT,
    Case.PhaseChoices.UNSIGNED_GENERATION,
    Case.PhaseChoices.BATCHING,
    Case.PhaseChoices.IN_BATCH,
    Case.PhaseChoices.COMPLETE,
]

# Forward transitions mapping
PHASE_TRANSITIONS = {
    Case.PhaseChoices.ASSESSMENT: Case.PhaseChoices.UNSIGNED_GENERATION,
    Case.PhaseChoices.UNSIGNED_GENERATION: Case.PhaseChoices.BATCHING,
    Case.PhaseChoices.BATCHING: Case.PhaseChoices.IN_BATCH,
    Case.PhaseChoices.IN_BATCH: Case.PhaseChoices.COMPLETE,
}


class WorkflowService:
    """Business logic for case workflow phase transitions."""

    @staticmethod
    def get_case(pk):
        """Retrieve a case by primary key.

        Raises:
            NotFound: If the case does not exist.
        """
        try:
            return Case.objects.select_related(
                "approved_botanist", "finance_officer"
            ).get(pk=pk)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

    @staticmethod
    def get_phase_transitions():
        """Return the mapping of current phase → next phase."""
        return PHASE_TRANSITIONS

    @staticmethod
    def get_phase_order():
        """Return the ordered list of phases."""
        return PHASE_ORDER

    @staticmethod
    def validate_transition(current_phase, target_phase, action="advance"):
        """Validate a forward phase transition request.

        Rules:
        - advance: only to the immediately next phase in sequence
        - no transitions from "complete"

        Raises:
            ValidationError: If the transition is invalid.
        """
        if current_phase == Case.PhaseChoices.COMPLETE:
            raise ValidationError("Cannot transition from complete phase.")

        if target_phase not in dict(Case.PhaseChoices.choices):
            raise ValidationError(
                {"target_phase": [f"Invalid target phase: {target_phase}"]}
            )

        if action != "advance":
            raise ValidationError(f"Invalid action: {action}")

        current_idx = PHASE_ORDER.index(current_phase)
        target_idx = PHASE_ORDER.index(target_phase)
        if target_idx != current_idx + 1:
            raise ValidationError("Can only advance to the next phase.")

    @staticmethod
    def _can_advance_from_unsigned(case):
        """A case may only leave unsigned_generation once it has at least one
        generated certificate."""
        return case.certificates.exists()

    @staticmethod
    @transaction.atomic
    def advance_case(case, user):
        """Advance a case to its next phase and record phase history.

        Returns:
            The new phase value.

        Raises:
            ValidationError: If the case cannot be advanced.
        """
        next_phase = PHASE_TRANSITIONS.get(case.phase)

        if not next_phase:
            raise ValidationError(
                f"Cannot advance from phase {case.get_phase_display()}."
            )

        if (
            case.phase == Case.PhaseChoices.UNSIGNED_GENERATION
            and not WorkflowService._can_advance_from_unsigned(case)
        ):
            raise ValidationError(
                "Generate at least one certificate before advancing to batching."
            )

        WorkflowService.validate_transition(case.phase, next_phase, "advance")

        old_phase = case.phase
        case.phase = next_phase
        case.last_actioned_by = user
        case.save(update_fields=["phase", "last_actioned_by"])

        CasePhaseHistory.objects.create(
            submission=case,
            from_phase=old_phase,
            to_phase=next_phase,
            action="advance",
            user=user,
        )

        settings.LOGGER.info(
            f"User {user} advanced case {case.case_number} "
            f"from {old_phase} to {next_phase}"
        )

        return next_phase


# Backward-compatible function aliases for existing consumers
def get_phase_transitions():
    """Backward-compatible alias."""
    return WorkflowService.get_phase_transitions()


def get_phase_order():
    """Backward-compatible alias."""
    return WorkflowService.get_phase_order()


def validate_transition(current_phase, target_phase, action="advance"):
    """Backward-compatible alias."""
    return WorkflowService.validate_transition(current_phase, target_phase, action)


def advance_submission_phase(submission, user):
    """Backward-compatible alias."""
    return WorkflowService.advance_case(submission, user)
