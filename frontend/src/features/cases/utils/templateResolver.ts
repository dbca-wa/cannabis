/**
 * Template variable resolution for Section C note templates.
 *
 * Resolves {{variable}} placeholders against the current case/form data.
 * Unknown or empty variables resolve to "[Pending]".
 */

import { formatCertificateDate } from "@/shared/utils/certificate-format.utils";
import type { DrugBag } from "../types/drugBags.types";

export interface TemplateContext {
	defendant_name: string;
	case_number: string;
	bag_count: string;
	received_date: string;
	tag_numbers: string;
	new_tag_numbers: string;
	content_types: string;
}

/** Available template variables with descriptions for the UI. */
export const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
	{
		key: "defendant_name",
		description: "Defendant surnames (comma-separated)",
	},
	{ key: "case_number", description: "Police reference number" },
	{ key: "bag_count", description: "Number of bags on this form" },
	{ key: "received_date", description: "Date samples were received" },
	{ key: "tag_numbers", description: "Original seal tag numbers" },
	{ key: "new_tag_numbers", description: "New seal tag numbers" },
	{ key: "content_types", description: "Content type descriptions" },
];

/**
 * Replace all {{variable}} placeholders in template content with resolved values.
 * Unrecognised or empty variables resolve to "[Pending]".
 */
export const resolveTemplate = (
	template: string,
	context: TemplateContext
): string => {
	return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
		const value = context[key as keyof TemplateContext];
		return value || "[Pending]";
	});
};

interface DefendantDetail {
	last_name?: string;
	given_names?: string | null;
}

/**
 * Build a TemplateContext from case data and bags.
 * Call this with the current caseData and the form's bag array.
 */
export const buildTemplateContext = (
	caseData: Record<string, unknown> | null,
	bags: DrugBag[]
): TemplateContext => {
	if (!caseData) {
		return {
			defendant_name: "",
			case_number: "",
			bag_count: "0",
			received_date: "",
			tag_numbers: "",
			new_tag_numbers: "",
			content_types: "",
		};
	}

	const defendants = (caseData.defendants_details as DefendantDetail[]) ?? [];
	const defendantName =
		defendants
			.map((d) => d.last_name ?? "")
			.filter(Boolean)
			.join(", ") || "UNKNOWN";

	const caseNumber = (caseData.case_number as string) ?? "";

	const receivedDate = formatCertificateDate(
		(caseData.received as string) ?? null
	);

	const tagNumbers = bags
		.map((b) => b.seal_tag_numbers)
		.filter(Boolean)
		.join(", ");

	const newTagNumbers = bags
		.map((b) => b.new_seal_tag_numbers)
		.filter(Boolean)
		.join(", ");

	const contentTypes = [
		...new Set(bags.map((b) => b.content_type_display).filter(Boolean)),
	].join(", ");

	return {
		defendant_name: defendantName,
		case_number: caseNumber,
		bag_count: `${bags.length} ${bags.length === 1 ? "bag" : "bags"}`,
		received_date: receivedDate === "[Pending]" ? "" : receivedDate,
		tag_numbers: tagNumbers,
		new_tag_numbers: newTagNumbers,
		content_types: contentTypes,
	};
};
