/**
 * Compute practice checklist progress by comparing the brief against the live
 * case and form data, so the guide can tick items off as the user enters them.
 *
 * Matching is deliberately forgiving (case-insensitive, trimmed, substring for
 * names) because the aim is encouragement, not strict validation.
 */
import type { IPracticeBrief } from "../types/practice.types";

export interface ChecklistItem {
	label: string;
	done: boolean;
	/** Expected value, shown as a hint. */
	expected?: string;
}

export interface ChecklistGroup {
	title: string;
	items: ChecklistItem[];
}

/** Loose case/space-insensitive text match. */
const norm = (v: unknown): string =>
	String(v ?? "")
		.trim()
		.toLowerCase();
const contains = (haystack: unknown, needle: string): boolean =>
	norm(haystack).includes(norm(needle)) && norm(needle) !== "";

/** Minimal shapes we read from the live case/forms (via the query cache). */
interface LiveBag {
	seal_tag_numbers?: string | null;
	new_seal_tag_numbers?: string | null;
	contains_female_plants?: boolean;
	assessment?: { determination?: string | null } | null;
}
interface LiveForm {
	security_movement_envelope?: string | null;
	bags?: LiveBag[];
}
export interface LiveCase {
	case_number?: string | null;
	submitting_officer?: number | null;
	submitting_officer_name?: string | null;
	station?: number | null;
	station_name?: string | null;
	approved_botanist?: number | null;
	defendant_names?: string[] | null;
}

/** Case-level checklist: the details entered when the case is created. */
export const buildCaseChecklist = (
	brief: IPracticeBrief,
	liveCase: LiveCase | null
): ChecklistGroup => {
	const c = liveCase ?? {};
	const defendantExpected = `${brief.defendant.last_name.toUpperCase()}, ${brief.defendant.given_names}`;
	const officerExpected = `${brief.officer.last_name.toUpperCase()}, ${brief.officer.given_names}`;
	const defendantNames = (c.defendant_names ?? []).join("; ");

	return {
		title: "On the case",
		items: [
			{
				label: "Police reference",
				expected: brief.case_number,
				done: norm(c.case_number) === norm(brief.case_number),
			},
			{
				label: "Defendant",
				expected: defendantExpected,
				done:
					contains(defendantNames, brief.defendant.last_name) &&
					contains(defendantNames, brief.defendant.given_names),
			},
			{
				label: "Submitting officer",
				expected: officerExpected,
				done:
					contains(c.submitting_officer_name, brief.officer.last_name) ||
					(c.submitting_officer != null &&
						contains(c.submitting_officer_name, brief.officer.given_names)),
			},
			{
				label: "Station",
				expected: brief.station,
				done: contains(c.station_name, brief.station),
			},
			{
				label: "Approved botanist (use the default)",
				done: c.approved_botanist != null,
			},
		],
	};
};

/** Per-form checklists: SME and each drug bag, matched against the live forms. */
export const buildFormChecklists = (
	brief: IPracticeBrief,
	liveForms: LiveForm[]
): ChecklistGroup[] => {
	return brief.forms.map((bf, i) => {
		const live = liveForms[i];
		const liveBags = live?.bags ?? [];
		const items: ChecklistItem[] = [];

		if (bf.security_movement_envelope) {
			items.push({
				label: "Security movement envelope",
				expected: bf.security_movement_envelope,
				done: contains(
					live?.security_movement_envelope,
					bf.security_movement_envelope
				),
			});
		}

		for (const bag of bf.bags) {
			const matched = liveBags.find((lb) =>
				contains(lb.seal_tag_numbers, bag.original_seal)
			);
			items.push({
				label: `Bag ${bag.original_seal}`,
				expected: `${bag.content_type.replace(/_/g, " ")} — ${bag.determination.replace(/_/g, " ")}${bag.female_plants ? " — female plants" : ""}`,
				done: !!matched && !!matched.assessment?.determination,
			});
		}

		return {
			title:
				brief.forms.length > 1 ? `Priority 3 form ${i + 1}` : "On the form",
			items,
		};
	});
};
