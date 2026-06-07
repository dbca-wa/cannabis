import { type Case, type CaseTiny } from "@/shared/types/backend-api.types";
import type { UICasePhase } from "../components/PhaseIndicator";

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
 * Get phase colour class for UI display
 */
export const getPhaseColorClass = (
	phase: string,
	isDark: boolean = false
): string => {
	const colorMap: Record<string, { light: string; dark: string }> = {
		data_entry: { light: "text-gray-600", dark: "text-gray-400" },
		finance_approval: { light: "text-cyan-600", dark: "text-cyan-400" },
		botanist_review: { light: "text-green-600", dark: "text-green-400" },
		documents: { light: "text-purple-600", dark: "text-purple-400" },
		send_emails: { light: "text-orange-600", dark: "text-orange-400" },
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
	const badgeMap: Record<string, string> = {
		data_entry: "bg-gray-100 text-gray-800",
		finance_approval: "bg-cyan-100 text-cyan-800",
		botanist_review: "bg-green-100 text-green-800",
		documents: "bg-purple-100 text-purple-800",
		send_emails: "bg-orange-100 text-orange-800",
		complete: "bg-emerald-100 text-emerald-800",
	};

	return badgeMap[phase] || "bg-gray-100 text-gray-800";
};

/**
 * Get phase hex colour for progress indicators
 */
export const getPhaseColor = (phase: string): string => {
	const colorMap: Record<string, string> = {
		data_entry: "#6c757d",
		finance_approval: "#17a2b8",
		botanist_review: "#28a745",
		documents: "#6f42c1",
		send_emails: "#fd7e14",
		complete: "#28a745",
	};

	return colorMap[phase] || "#6c757d";
};

/**
 * Get phase display name
 */
export const getPhaseDisplay = (phase: string): string => {
	const displayMap: Record<string, string> = {
		data_entry: "Data Entry",
		finance_approval: "Finance Approval",
		botanist_review: "Botanist Review",
		documents: "Documents",
		send_emails: "Send Emails",
		complete: "Complete",
	};

	return displayMap[phase] || phase;
};

/**
 * Get human-readable label for a UI case phase
 */
export const getPhaseLabel = (phase: UICasePhase): string => {
	const labels: Record<UICasePhase, string> = {
		data_entry_start: "Data Entry",
		finance_approval_provided: "Finance Approval",
		botanist_approval_provided: "Botanist Approval",
		in_review: "Review",
		certificate_generation_start: "Certificate Generation",
		invoice_generation_start: "Invoice Generation",
		sending_emails: "Sending Emails",
		complete: "Complete",
	};
	return labels[phase] || phase;
};

/**
 * Get description text for phase advancement confirmation dialog
 */
export const getAdvancementDescription = (
	currentPhase: UICasePhase,
	nextPhase: UICasePhase
): string => {
	const descriptions: Record<string, string> = {
		"data_entry_start->finance_approval_provided":
			" This indicates that data entry is complete and the case is ready for finance approval.",
		"finance_approval_provided->botanist_approval_provided":
			" This confirms finance approval and moves the case to botanist approval.",
		"botanist_approval_provided->in_review":
			" This confirms botanist approval and moves the case to final review.",
		"in_review->certificate_generation_start":
			" This will trigger automatic certificate generation.",
	};

	const key = `${currentPhase}->${nextPhase}`;
	return descriptions[key] || "";
};
