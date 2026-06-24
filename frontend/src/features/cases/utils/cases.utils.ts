import { type Case, type CaseTiny } from "@/shared/types/backend-api.types";
import type { UICasePhase } from "../components/PhaseIndicator";
import {
	PHASE_DISPLAY_NAMES,
	PHASE_HEX_COLOURS,
	PHASE_BADGE_COLOURS,
} from "@/shared/constants/phases.config";

/**
 * Check if a case can be deleted (no associated certificates/invoices)
 */
export const canDeleteCase = (caseObj: Case): boolean => {
	return caseObj.certificates.length === 0 && caseObj.invoices.length === 0;
};

/**
 * Get deletion warning message for a case
 */
export const getDeletionWarningMessage = (caseObj: Case): string => {
	if (caseObj.certificates.length > 0) {
		return `Cannot delete case ${caseObj.case_number} because it has ${caseObj.certificates.length} associated certificate(s).`;
	}
	if (caseObj.invoices.length > 0) {
		return `Cannot delete case ${caseObj.case_number} because it has ${caseObj.invoices.length} associated invoice(s).`;
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
		case_creation: { light: "text-amber-600", dark: "text-amber-400" },
		assessment: { light: "text-teal-600", dark: "text-teal-400" },
		unsigned_generation: { light: "text-blue-600", dark: "text-blue-400" },
		botanist_signoff: { light: "text-violet-600", dark: "text-violet-400" },
		invoicing: { light: "text-rose-600", dark: "text-rose-400" },
		send_emails: { light: "text-sky-600", dark: "text-sky-400" },
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
		"case_creation->assessment":
			" Case creation is complete. Moving to assessment phase.",
		"assessment->unsigned_generation":
			" Assessment is complete. Moving to certificate generation.",
		"unsigned_generation->botanist_signoff":
			" Certificate generated. Moving to botanist sign-off.",
		"botanist_signoff->invoicing":
			" Certificate signed. Moving to invoice generation.",
		"invoicing->send_emails":
			" Invoice generated. Moving to email distribution.",
		"send_emails->complete":
			" Documents sent. Case will be marked as complete.",
	};

	const key = `${currentPhase}->${nextPhase}`;
	return descriptions[key] || "";
};
