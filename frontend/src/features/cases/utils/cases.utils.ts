import { type Case, type CaseTiny } from "@/shared/types/backend-api.types";
import type { UICasePhase } from "../components/PhaseIndicator";
import {
	PHASE_DISPLAY_NAMES,
	PHASE_HEX_COLOURS,
	PHASE_BADGE_COLOURS,
} from "@/shared/constants/phases.config";

/**
 * Check if a case can be deleted (no associated certificates)
 */
export const canDeleteCase = (caseObj: Case): boolean => {
	return caseObj.certificates.length === 0;
};

/**
 * Get deletion warning message for a case
 */
export const getDeletionWarningMessage = (caseObj: Case): string => {
	if (caseObj.certificates.length > 0) {
		return `Cannot delete case ${caseObj.case_number} because it has ${caseObj.certificates.length} associated certificate(s).`;
	}
	return "";
};

/**
 * Format case display name for UI
 */
export const formatCaseDisplayName = (caseObj: Case | CaseTiny): string => {
	return `${caseObj.case_number} - ${caseObj.phase_display}`;
};

/**
 * Get phase colour class for UI display (text colour)
 */
export const getPhaseColorClass = (
	phase: string,
	isDark: boolean = false
): string => {
	const colorMap: Record<string, { light: string; dark: string }> = {
		assessment: { light: "text-teal-600", dark: "text-teal-400" },
		unsigned_generation: { light: "text-blue-600", dark: "text-blue-400" },
		batching: { light: "text-violet-600", dark: "text-violet-400" },
		complete: { light: "text-emerald-600", dark: "text-emerald-400" },
	};

	const colors = colorMap[phase];
	if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

	return isDark ? colors.dark : colors.light;
};

/**
 * Get phase background colour class for badges
 */
export const getPhaseBadgeClass = (phase: string): string => {
	return (
		PHASE_BADGE_COLOURS[phase as UICasePhase] ||
		"bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
	);
};

/**
 * Get phase hex colour for progress indicators and charts
 */
export const getPhaseColor = (phase: string): string => {
	return PHASE_HEX_COLOURS[phase as UICasePhase] || "#6b7280";
};

/**
 * Get phase display name
 */
export const getPhaseDisplay = (phase: string): string => {
	return PHASE_DISPLAY_NAMES[phase as UICasePhase] || phase;
};

/**
 * Get human-readable label for a UI case phase
 */
export const getPhaseLabel = (phase: UICasePhase): string => {
	return PHASE_DISPLAY_NAMES[phase] || phase;
};

/**
 * Get description text for phase advancement confirmation dialog
 */
export const getAdvancementDescription = (
	currentPhase: UICasePhase,
	nextPhase: UICasePhase
): string => {
	const descriptions: Record<string, string> = {
		"assessment->unsigned_generation":
			" Assessment is complete. Moving to certificate generation.",
		"unsigned_generation->batching":
			" Certificate(s) generated. The case is now ready for batching.",
		"batching->complete":
			" Recorded against a batch invoice. Case will be marked as complete.",
	};

	const key = `${currentPhase}->${nextPhase}`;
	return descriptions[key] || "";
};
