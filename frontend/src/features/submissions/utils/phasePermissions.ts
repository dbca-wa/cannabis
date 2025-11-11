/**
 * Phase Permission Utility Functions
 *
 * Provides role-based permission checks for submission phase workflow operations.
 * Implements requirements 3.1-3.8, 4.1-4.7, and 15.1-15.6.
 */

import type {
	SubmissionPhase,
	UserRole,
	Submission,
} from "@/shared/types/backend-api.types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * User role for permission checks
 * Simplified from UserRole to focus on workflow permissions
 */
export type WorkflowUserRole = "botanist" | "finance" | "none";

/**
 * Phase advancement permissions configuration
 * Maps each phase to the roles that can advance from that phase
 */
const ADVANCE_PERMISSIONS: Record<SubmissionPhase, WorkflowUserRole[]> = {
	data_entry: ["botanist", "finance"],
	finance_approval: ["finance"],
	botanist_review: ["botanist"],
	documents: ["botanist", "finance"],
	send_emails: ["botanist", "finance"],
	complete: [], // No one can advance from complete
};

/**
 * Send-back permissions configuration
 * Maps each phase to the roles that can send back from that phase
 */
const SEND_BACK_PERMISSIONS: Record<SubmissionPhase, WorkflowUserRole[]> = {
	data_entry: [], // Cannot send back from data entry (first phase)
	finance_approval: ["finance"],
	botanist_review: ["botanist"],
	documents: ["botanist", "finance"],
	send_emails: ["botanist", "finance"],
	complete: [], // Cannot send back from complete
};

/**
 * Edit permissions configuration
 * Maps each phase to the roles that can edit content in that phase
 */
const EDIT_PERMISSIONS: Record<SubmissionPhase, WorkflowUserRole[]> = {
	data_entry: ["botanist", "finance"],
	finance_approval: ["finance"],
	botanist_review: ["botanist"],
	documents: ["botanist", "finance"],
	send_emails: ["botanist", "finance"],
	complete: [], // Complete phase is read-only
};

// ============================================================================
// PERMISSION CHECK FUNCTIONS
// ============================================================================

/**
 * Check if user can advance from the given phase
 *
 * @param phase - The current phase to check advancement from
 * @param userRole - The user's role (botanist, finance, or none)
 * @param isAdmin - Whether the user is an admin (is_superuser)
 * @returns true if user can advance from this phase
 *
 * @example
 * // Finance officer can advance from finance_approval
 * canAdvancePhase("finance_approval", "finance", false) // true
 *
 * // Botanist cannot advance from finance_approval
 * canAdvancePhase("finance_approval", "botanist", false) // false
 *
 * // Admin can advance from any phase
 * canAdvancePhase("finance_approval", "none", true) // true
 */
export function canAdvancePhase(
	phase: SubmissionPhase,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	// Admin override - admins can advance from any phase
	if (isAdmin) return true;

	// Check if user's role is in the allowed roles for this phase
	const allowedRoles = ADVANCE_PERMISSIONS[phase];
	return allowedRoles.includes(userRole);
}

/**
 * Check if user can send back from the given phase
 *
 * @param phase - The current phase to check send-back from
 * @param userRole - The user's role (botanist, finance, or none)
 * @param isAdmin - Whether the user is an admin (is_superuser)
 * @returns true if user can send back from this phase
 *
 * @example
 * // Finance officer can send back from finance_approval
 * canSendBack("finance_approval", "finance", false) // true
 *
 * // Cannot send back from data_entry (first phase)
 * canSendBack("data_entry", "finance", false) // false
 *
 * // Admin can send back from any phase
 * canSendBack("botanist_review", "none", true) // true
 */
export function canSendBack(
	phase: SubmissionPhase,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	// Admin override - admins can send back from any phase
	if (isAdmin) return true;

	// Check if user's role is in the allowed roles for this phase
	const allowedRoles = SEND_BACK_PERMISSIONS[phase];
	return allowedRoles.includes(userRole);
}

/**
 * Check if user can edit content in the given phase
 *
 * @param phase - The phase to check edit permission for
 * @param isCurrentPhase - Whether this is the current active phase
 * @param userRole - The user's role (botanist, finance, or none)
 * @param isAdmin - Whether the user is an admin (is_superuser)
 * @returns true if user can edit content in this phase
 *
 * @example
 * // Finance officer can edit finance_approval when it's current
 * canEditPhase("finance_approval", true, "finance", false) // true
 *
 * // Cannot edit historical phases (not current)
 * canEditPhase("data_entry", false, "finance", false) // false
 *
 * // Admin can edit any phase when it's current
 * canEditPhase("botanist_review", true, "none", true) // true
 */
export function canEditPhase(
	phase: SubmissionPhase,
	isCurrentPhase: boolean,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	// Can only edit the current phase, not historical phases
	if (!isCurrentPhase) return false;

	// Admin override - admins can edit any current phase
	if (isAdmin) return true;

	// Check if user's role is in the allowed roles for this phase
	const allowedRoles = EDIT_PERMISSIONS[phase];
	return allowedRoles.includes(userRole);
}

/**
 * Get list of completed phases based on current phase
 *
 * @param currentPhase - The current active phase of the submission
 * @returns Array of phases that have been completed
 *
 * @example
 * // Submission in botanist_review has completed data_entry and finance_approval
 * getCompletedPhases("botanist_review")
 * // Returns: ["data_entry", "finance_approval"]
 *
 * // Submission in data_entry has no completed phases
 * getCompletedPhases("data_entry")
 * // Returns: []
 */
export function getCompletedPhases(
	currentPhase: SubmissionPhase
): SubmissionPhase[] {
	const phases: SubmissionPhase[] = [
		"data_entry",
		"finance_approval",
		"botanist_review",
		"documents",
		"send_emails",
		"complete",
	];

	const currentPhaseIndex = phases.indexOf(currentPhase);

	// Return all phases before the current phase
	return phases.slice(0, currentPhaseIndex);
}

/**
 * Calculate phase progress percentage
 *
 * @param currentPhase - The current active phase of the submission
 * @returns Progress percentage (0-100)
 *
 * @example
 * // Data entry is 0% complete (first phase)
 * getPhaseProgress("data_entry") // 0
 *
 * // Finance approval is 20% complete (second of 6 phases)
 * getPhaseProgress("finance_approval") // 20
 *
 * // Complete is 100% complete (last phase)
 * getPhaseProgress("complete") // 100
 */
export function getPhaseProgress(currentPhase: SubmissionPhase): number {
	const phases: SubmissionPhase[] = [
		"data_entry",
		"finance_approval",
		"botanist_review",
		"documents",
		"send_emails",
		"complete",
	];

	const currentPhaseIndex = phases.indexOf(currentPhase);

	// Calculate percentage: (current index / (total phases - 1)) * 100
	// We use (total - 1) because we want complete to be 100%, not 120%
	const progress = (currentPhaseIndex / (phases.length - 1)) * 100;

	return Math.round(progress);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert UserRole to WorkflowUserRole
 *
 * @param role - The user's role from the User object
 * @returns Workflow-compatible role
 */
export function toWorkflowRole(role: UserRole): WorkflowUserRole {
	// UserRole is already "botanist" | "finance" | "none"
	return role as WorkflowUserRole;
}

/**
 * Check if a phase is clickable (can be viewed)
 *
 * @param phase - The phase to check
 * @param currentPhase - The current active phase
 * @returns true if the phase can be clicked to view
 *
 * @example
 * // Can view completed phases
 * isPhaseClickable("data_entry", "botanist_review") // true
 *
 * // Can view current phase
 * isPhaseClickable("botanist_review", "botanist_review") // true
 *
 * // Cannot view future phases
 * isPhaseClickable("documents", "botanist_review") // false
 */
export function isPhaseClickable(
	phase: SubmissionPhase,
	currentPhase: SubmissionPhase
): boolean {
	const completedPhases = getCompletedPhases(currentPhase);
	return completedPhases.includes(phase) || phase === currentPhase;
}

/**
 * Get the next phase in the workflow
 *
 * @param currentPhase - The current active phase
 * @returns The next phase, or null if already at complete
 *
 * @example
 * getNextPhase("data_entry") // "finance_approval"
 * getNextPhase("complete") // null
 */
export function getNextPhase(
	currentPhase: SubmissionPhase
): SubmissionPhase | null {
	const phases: SubmissionPhase[] = [
		"data_entry",
		"finance_approval",
		"botanist_review",
		"documents",
		"send_emails",
		"complete",
	];

	const currentIndex = phases.indexOf(currentPhase);

	// If already at complete or phase not found, return null
	if (currentIndex === -1 || currentIndex === phases.length - 1) {
		return null;
	}

	return phases[currentIndex + 1];
}

/**
 * Get available send-back target phases
 *
 * @param currentPhase - The current active phase
 * @returns Array of phases that can be sent back to
 *
 * @example
 * // From botanist_review, can send back to finance_approval or data_entry
 * getSendBackTargets("botanist_review")
 * // Returns: ["data_entry", "finance_approval"]
 *
 * // From data_entry, cannot send back (first phase)
 * getSendBackTargets("data_entry")
 * // Returns: []
 */
export function getSendBackTargets(
	currentPhase: SubmissionPhase
): SubmissionPhase[] {
	// Can only send back to earlier phases
	return getCompletedPhases(currentPhase);
}

/**
 * Check if user has any permissions for the submission
 *
 * @param submission - The submission to check
 * @param userRole - The user's role
 * @param isAdmin - Whether the user is an admin
 * @returns true if user can perform any action on the submission
 */
export function hasAnyPermission(
	submission: Submission,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	const currentPhase = submission.phase;

	return (
		canAdvancePhase(currentPhase, userRole, isAdmin) ||
		canSendBack(currentPhase, userRole, isAdmin) ||
		canEditPhase(currentPhase, true, userRole, isAdmin)
	);
}
