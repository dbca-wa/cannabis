import type { CasePhase } from "@/shared/types/backend-api.types";

export const PHASE_DISPLAY_NAMES: Record<CasePhase, string> = {
	data_entry: "Data Entry",
	finance_approval: "Finance Approval",
	botanist_review: "Assessment",
	documents: "Certificate Generation",
	botanist_signoff: "Botanist Sign-Off",
	invoicing: "Invoice Generation",
	send_emails: "Send Emails",
	complete: "Complete",
};

export const PHASE_BADGE_COLOURS: Record<CasePhase, string> = {
	data_entry: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
	finance_approval:
		"bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
	botanist_review:
		"bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
	documents:
		"bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
	botanist_signoff:
		"bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
	invoicing:
		"bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
	send_emails:
		"bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
	complete:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};
