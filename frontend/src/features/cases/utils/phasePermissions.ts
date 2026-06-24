/**
 * Phase Permission Utility Functions
 *
 * Provides role-based permission checks for case phase workflow operations.
 * Defines which roles can perform which actions at each phase of the case lifecycle.
 */

import type {
	CasePhase,
	UserRole,
	Case,
} from "@/shared/types/backend-api.types";
import {
	getPhaseProgress,
	getNextPhase,
	getCompletedPhases,
} from "@/shared/constants/phases.config";

// Re-export helpers from canonical config for consumers that import from here
export { getPhaseProgress, getNextPhase, getCompletedPhases };

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
const ADVANCE_PERMISSIONS: Record<CasePhase, WorkflowUserRole[]> = {
	case_creation: ["botanist", "finance"],
	assessment: ["botanist"],
	unsigned_generation: ["botanist", "finance"],
	botanist_signoff: ["botanist"],
	invoicing: ["finance"],
	send_emails: ["botanist", "finance"],
	complete: [], // No one can advance from complete
};

/**
 * Send-back permissions configuration
 * Maps each phase to the roles that can send back from that phase
 */
const SEND_BACK_PERMISSIONS: Record<CasePhase, WorkflowUserRole[]> = {
	case_creation: [], // Cannot send back from case creation (first phase)
	assessment: ["botanist", "finance"],
	unsigned_generation: ["botanist", "finance"],
	botanist_signoff: ["botanist"],
	invoicing: ["finance"],
	send_emails: ["botanist", "finance"],
	complete: [], // Cannot send back from complete
};

/**
 * Edit permissions configuration
 * Maps each phase to the roles that can edit content in that phase
 */
const EDIT_PERMISSIONS: Record<CasePhase, WorkflowUserRole[]> = {
	case_creation: ["botanist", "finance"],
	assessment: ["botanist"],
	unsigned_generation: ["botanist", "finance"],
	botanist_signoff: ["botanist"],
	invoicing: ["finance"],
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
 * canAdvancePhase("case_creation", "finance", false) // true
 * canAdvancePhase("assessment", "finance", false) // false
 * canAdvancePhase("invoicing", "none", true) // true (admin override)
 */
export function canAdvancePhase(
	phase: CasePhase,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	if (isAdmin) return true;
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
 * canSendBack("assessment", "finance", false) // true
 * canSendBack("case_creation", "finance", false) // false (first phase)
 * canSendBack("botanist_signoff", "none", true) // true (admin override)
 */
export function canSendBack(
	phase: CasePhase,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	if (isAdmin) return true;
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
 * canEditPhase("case_creation", true, "finance", false) // true
 * canEditPhase("case_creation", false, "finance", false) // false (not current)
 * canEditPhase("assessment", true, "none", true) // true (admin override)
 */
export function canEditPhase(
	phase: CasePhase,
	isCurrentPhase: boolean,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	if (!isCurrentPhase) return false;
	if (isAdmin) return true;
	const allowedRoles = EDIT_PERMISSIONS[phase];
	return allowedRoles.includes(userRole);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert UserRole to WorkflowUserRole
 */
export function toWorkflowRole(role: UserRole): WorkflowUserRole {
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
 * isPhaseClickable("case_creation", "assessment") // true (completed)
 * isPhaseClickable("assessment", "assessment") // true (current)
 * isPhaseClickable("unsigned_generation", "assessment") // false (future)
 */
export function isPhaseClickable(
	phase: CasePhase,
	currentPhase: CasePhase
): boolean {
	const completedPhases = getCompletedPhases(currentPhase);
	return completedPhases.includes(phase) || phase === currentPhase;
}

/**
 * Get available send-back target phases (all completed phases before current)
 *
 * @example
 * getSendBackTargets("assessment") // ["case_creation"]
 * getSendBackTargets("case_creation") // []
 */
export function getSendBackTargets(currentPhase: CasePhase): CasePhase[] {
	return getCompletedPhases(currentPhase);
}

/**
 * Check if user has any permissions for the case
 */
export function hasAnyPermission(
	caseObj: Case,
	userRole: WorkflowUserRole,
	isAdmin: boolean
): boolean {
	const currentPhase = caseObj.phase;

	return (
		canAdvancePhase(currentPhase, userRole, isAdmin) ||
		canSendBack(currentPhase, userRole, isAdmin) ||
		canEditPhase(currentPhase, true, userRole, isAdmin)
	);
}
