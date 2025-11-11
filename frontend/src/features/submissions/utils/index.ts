/**
 * Submissions Utility Functions
 *
 * Exports all utility functions for the submissions feature
 */

// Phase permission utilities
export {
	canAdvancePhase,
	canSendBack,
	canEditPhase,
	getCompletedPhases,
	getPhaseProgress,
	toWorkflowRole,
	isPhaseClickable,
	getNextPhase,
	getSendBackTargets,
	hasAnyPermission,
	type WorkflowUserRole,
} from "./phasePermissions";
