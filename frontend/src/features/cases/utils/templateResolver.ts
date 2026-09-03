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
	security_movement_envelope: string;
	female_plant_tags: string;
	non_female_plant_tags: string;
	female_plant_count: string;
	non_female_plant_count: string;
	conveying_officer: string;
	requesting_officer: string;
}

/** Available template variables with descriptions for the UI. */
export const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
	{
		key: "defendant_name",
		description: "Defendant surnames (comma-separated)",
	},
	{ key: "case_number", description: "Police reference number" },
	{ key: "bag_count", description: "Total number of bags on this form" },
	{ key: "received_date", description: "Date samples were received" },
	{ key: "tag_numbers", description: "Original seal tag numbers (all bags)" },
	{ key: "new_tag_numbers", description: "New seal tag numbers (all bags)" },
	{ key: "content_types", description: "Content type descriptions" },
	{
		key: "security_movement_envelope",
		description: "Security movement envelope number",
	},
	{
		key: "female_plant_tags",
		description: "Seal numbers of bags containing female plants",
	},
	{
		key: "non_female_plant_tags",
		description: "Seal numbers of bags NOT containing female plants",
	},
	{
		key: "female_plant_count",
		description: "Number of bags containing female plants",
	},
	{
		key: "non_female_plant_count",
		description: "Number of bags NOT containing female plants",
	},
	{
		key: "conveying_officer",
		description: "Conveying (submitting) officer name",
	},
	{
		key: "requesting_officer",
		description: "Requesting (on behalf of) officer name",
	},
];

/** Mock data for template preview — shows realistic example values for all variables. */
export const MOCK_TEMPLATE_CONTEXT: TemplateContext = {
	defendant_name: "SMITH, JONES",
	case_number: "IR 123456789",
	bag_count: "3 bags",
	received_date: "20 March 2026",
	tag_numbers: "T119007, T119008, T119009",
	new_tag_numbers: "T220001, T220002, T220003",
	content_types: "plant",
	security_movement_envelope: "WW00564835",
	female_plant_tags: "T119007, T119009",
	non_female_plant_tags: "T119008",
	female_plant_count: "2",
	non_female_plant_count: "1",
	conveying_officer: "Unsworn Officer NEUTRON, Jimmy",
	requesting_officer: "Sworn Officer PD9998 LIGHTYEAR, Buzz",
};

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
			security_movement_envelope: "",
			female_plant_tags: "",
			non_female_plant_tags: "",
			female_plant_count: "0",
			non_female_plant_count: "0",
			conveying_officer: "",
			requesting_officer: "",
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

	const femalePlantTags = bags
		.filter((b) => b.contains_female_plants)
		.map((b) => b.seal_tag_numbers)
		.filter(Boolean)
		.join(", ");

	const nonFemalePlantTags = bags
		.filter((b) => !b.contains_female_plants)
		.map((b) => b.seal_tag_numbers)
		.filter(Boolean)
		.join(", ");

	const femalePlantCount = bags.filter((b) => b.contains_female_plants).length;
	const nonFemalePlantCount = bags.filter(
		(b) => !b.contains_female_plants
	).length;

	return {
		defendant_name: defendantName,
		case_number: caseNumber,
		bag_count: `${bags.length} ${bags.length === 1 ? "bag" : "bags"}`,
		received_date: receivedDate === "[Pending]" ? "" : receivedDate,
		tag_numbers: tagNumbers,
		new_tag_numbers: newTagNumbers,
		content_types: contentTypes,
		security_movement_envelope:
			(caseData.security_movement_envelope as string) ?? "",
		female_plant_tags: femalePlantTags,
		non_female_plant_tags: nonFemalePlantTags,
		female_plant_count: femalePlantCount > 0 ? String(femalePlantCount) : "",
		non_female_plant_count:
			nonFemalePlantCount > 0 ? String(nonFemalePlantCount) : "",
		conveying_officer: (caseData.submitting_officer_name as string) ?? "",
		requesting_officer: (caseData.requesting_officer_name as string) ?? "",
	};
};

/**
 * Extract all {{variable}} keys from a template string.
 */
export const extractTemplateVariables = (template: string): string[] => {
	const matches = template.matchAll(/\{\{(\w+)\}\}/g);
	return [...new Set([...matches].map((m) => m[1]))];
};

/**
 * Check if a template can be fully resolved (all referenced variables have values).
 * Returns true if all variables in the template have non-empty values in the context.
 */
export const canResolveTemplate = (
	template: string,
	context: TemplateContext
): boolean => {
	const variables = extractTemplateVariables(template);
	return variables.every((key) => {
		const value = context[key as keyof TemplateContext];
		return !!value && value.trim() !== "";
	});
};
