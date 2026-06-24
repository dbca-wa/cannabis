"""Workflow service — phase transition and send-back business logic.

Handles the 7-phase case state machine:
  case_creation → assessment → unsigned_generation → botanist_signoff →
  invoicing → send_emails → complete
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from ..models import Case, CasePhaseHistory

# Ordered phase sequence for transition validation
PHASE_ORDER = [
    Case.PhaseChoices.CASE_CREATION,
    Case.PhaseChoices.ASSESSMENT,
    Case.PhaseChoices.UNSIGNED_GENERATION,
    Case.PhaseChoices.BOTANIST_SIGNOFF,
    Case.PhaseChoices.INVOICING,
    Case.PhaseChoices.SEND_EMAILS,
    Case.PhaseChoices.COMPLETE,
]

# Forward transitions mapping
PHASE_TRANSITIONS = {
    Case.PhaseChoices.CASE_CREATION: Case.PhaseChoices.ASSESSMENT,
    Case.PhaseChoices.ASSESSMENT: Case.PhaseChoices.UNSIGNED_GENERATION,
    Case.PhaseChoices.UNSIGNED_GENERATION: Case.PhaseChoices.BOTANIST_SIGNOFF,
    Case.PhaseChoices.BOTANIST_SIGNOFF: Case.PhaseChoices.INVOICING,
    Case.PhaseChoices.INVOICING: Case.PhaseChoices.SEND_EMAILS,
    Case.PhaseChoices.SEND_EMAILS: Case.PhaseChoices.COMPLETE,
}


class WorkflowService:
    """Business logic for case workflow phase transitions."""

    @staticmethod
    def get_case(pk):
        """Retrieve a case by primary key.

        Args:
            pk: The case primary key.

        Returns:
            The Case instance.

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
    def validate_transition(current_phase, target_phase, action, reason=None):
        """Validate a phase transition request.

        Rules:
        - advance: only to the immediately next phase in sequence
        - send_back: to any earlier phase, requires non-empty reason
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

        current_idx = PHASE_ORDER.index(current_phase)
        target_idx = PHASE_ORDER.index(target_phase)

        if action == "advance":
            if target_idx != current_idx + 1:
                raise ValidationError("Can only advance to the next phase.")
        elif action == "send_back":
            if target_idx >= current_idx:
                raise ValidationError("Can only send back to an earlier phase.")
            if not reason or not reason.strip():
                raise ValidationError(
                    {"reason": ["Reason is required for send-back actions."]}
                )
        else:
            raise ValidationError(f"Invalid action: {action}")

    @staticmethod
    @transaction.atomic
    def advance_case(case, user):
        """Advance a case to its next phase and record phase history.

        Args:
            case: The Case instance to advance.
            user: The user performing the action.

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

        WorkflowService.validate_transition(case.phase, next_phase, "advance")

        old_phase = case.phase
        case.phase = next_phase
        case.save(update_fields=["phase"])

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

    @staticmethod
    @transaction.atomic
    def send_back_case(case, target_phase, reason, user):
        """Send a case back to an earlier phase with a reason.

        Args:
            case: The Case instance.
            target_phase: The phase to send back to.
            reason: The reason for the send-back.
            user: The user performing the action.

        Returns:
            A dict with the response payload.

        Raises:
            ValidationError: If the target phase or reason is invalid.
        """
        if not target_phase:
            raise ValidationError({"target_phase": ["This field is required."]})

        WorkflowService.validate_transition(
            case.phase, target_phase, "send_back", reason
        )

        old_phase_display = case.get_phase_display()

        CasePhaseHistory.objects.create(
            submission=case,
            from_phase=case.phase,
            to_phase=target_phase,
            action="send_back",
            user=user,
            reason=reason,
        )

        case.phase = target_phase
        case.save(update_fields=["phase"])

        new_phase_display = case.get_phase_display()

        settings.LOGGER.info(
            f"User {user.get_full_name()} sent back case {case.case_number} "
            f"from {old_phase_display} to {new_phase_display}. Reason: {reason}"
        )

        return {
            "message": f"Case sent back to {new_phase_display}",
            "new_phase": target_phase,
            "sent_back_by": user.get_full_name(),
            "sent_back_at": timezone.now().isoformat(),
            "reason": reason,
        }


# Backward-compatible function aliases for existing consumers
def get_phase_transitions():
    """Backward-compatible alias."""
    return WorkflowService.get_phase_transitions()


def get_phase_order():
    """Backward-compatible alias."""
    return WorkflowService.get_phase_order()


def validate_transition(current_phase, target_phase, action, reason=None):
    """Backward-compatible alias."""
    return WorkflowService.validate_transition(
        current_phase, target_phase, action, reason
    )


def advance_submission_phase(submission, user):
    """Backward-compatible alias."""
    return WorkflowService.advance_case(submission, user)


def validate_send_back(submission, target_phase, reason, user):
    """Backward-compatible alias."""
    if not target_phase:
        raise ValidationError({"target_phase": ["This field is required."]})
    WorkflowService.validate_transition(
        submission.phase, target_phase, "send_back", reason
    )


def send_back_submission(submission, target_phase, reason, user):
    """Backward-compatible alias."""
    return WorkflowService.send_back_case(submission, target_phase, reason, user)
