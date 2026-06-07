/**
 * Cases Utility Functions
 *
 * Exports all utility functions for the cases feature
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

// Case display and phase utilities
export {
	canDeleteCase,
	getDeletionWarningMessage,
	formatCaseDisplayName,
	getPhaseColorClass,
	getPhaseBadgeClass,
	getPhaseColor,
	getPhaseDisplay,
} from "./cases.utils";

// Drug bag display utilities
export {
	formatDrugBagDisplayName,
	getContentTypeColorClass,
	getContentTypeBadgeClass,
} from "./drugBags.utils";

// Assessment display utilities
export {
	getDeterminationColorClass,
	getDeterminationBadgeClass,
	isCannabis,
	isControlledSubstance,
} from "./assessments.utils";
