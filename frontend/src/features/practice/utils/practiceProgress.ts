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
	/** Flat name from the list serializer / live create data. */
	submitting_officer_name?: string | null;
	/** Nested record from the case detail serializer. */
	submitting_officer_details?: { full_name?: string | null } | null;
	station?: number | null;
	/** Flat name from the list serializer / live create data. */
	station_name?: string | null;
	/** Nested record from the case detail serializer. */
	station_details?: { name?: string | null } | null;
	approved_botanist?: number | null;
	/** Flat names from the list serializer / live create data. */
	defendant_names?: string[] | null;
	/** Nested records from the case detail serializer. */
	defendants_details?: Array<{ full_name?: string | null }> | null;
}

/** Case-level checklist: the details entered when the case is created. */
export const buildCaseChecklist = (
	brief: IPracticeBrief,
	liveCase: LiveCase | null
): ChecklistGroup => {
	const c = liveCase ?? {};
	const defendantExpected = `${brief.defendant.last_name.toUpperCase()}, ${brief.defendant.given_names}`;
	const officerExpected = `${brief.officer.last_name.toUpperCase()}, ${brief.officer.given_names}`;

	// The create flow and the case-list serializer expose flat *_name fields;
	// the case-detail serializer (shown on the process-case page) exposes nested
	// *_details records instead. Read whichever is present so items stay ticked
	// after the case is saved and the guide switches to the detail data.
	const officerName =
		c.submitting_officer_name ??
		c.submitting_officer_details?.full_name ??
		null;
	const stationName = c.station_name ?? c.station_details?.name ?? null;
	const defendantNames = (
		c.defendant_names ??
		(c.defendants_details ?? []).map((d) => d.full_name ?? "")
	).join("; ");

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
					contains(officerName, brief.officer.last_name) ||
					(c.submitting_officer != null &&
						contains(officerName, brief.officer.given_names)),
			},
			{
				label: "Station",
				expected: brief.station,
				done: contains(stationName, brief.station),
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
			// Spell out both seal tags so the user knows what to type into the
			// original and new seal fields, plus the content and determination.
			const details = [
				bag.content_type.replace(/_/g, " "),
				bag.determination.replace(/_/g, " "),
				bag.female_plants ? "female plants" : null,
			]
				.filter(Boolean)
				.join(" · ");
			const newSealEntered =
				!bag.new_seal || contains(matched?.new_seal_tag_numbers, bag.new_seal);
			items.push({
				label: `Bag — original ${bag.original_seal}, new ${bag.new_seal}`,
				expected: details,
				done:
					!!matched && !!matched.assessment?.determination && newSealEntered,
			});
		}

		return {
			title:
				brief.forms.length > 1 ? `Priority 3 form ${i + 1}` : "On the form",
			items,
		};
	});
};
