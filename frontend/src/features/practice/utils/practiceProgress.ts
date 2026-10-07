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
/** Exact (case/space-insensitive) equality — used where the brief must match
 * precisely, e.g. a bag's content type or determination. */
const eq = (a: unknown, b: unknown): boolean =>
	norm(a) === norm(b) && norm(b) !== "";

/** Minimal shapes we read from the live case/forms (via the query cache). */
interface LiveBag {
	seal_tag_numbers?: string | null;
	new_seal_tag_numbers?: string | null;
	content_type?: string | null;
	contains_female_plants?: boolean;
	assessment?: { determination?: string | null } | null;
}
interface LiveForm {
	security_movement_envelope?: string | null;
	bags?: LiveBag[];
	/** The form's single certificate, once generated. */
	certificate?: { id: number } | null;
	/** Whether the generated certificate has been reviewed and marked ready. */
	marked_ready?: boolean;
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

		// The first thing to do on this step is add the Priority 3 form itself;
		// it ticks off once the matching live form exists.
		items.push({
			label: "Add a Priority 3 form",
			done: !!live,
		});

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
			// A bag only ticks when every detail matches the brief exactly: the
			// new seal tag, the content type, the determination, and whether it
			// holds female plants. Matching the seal tag alone is not enough —
			// entering the wrong type or determination must leave it unticked.
			const newSealMatches =
				!bag.new_seal || eq(matched?.new_seal_tag_numbers, bag.new_seal);
			const contentTypeMatches = eq(matched?.content_type, bag.content_type);
			const determinationMatches = eq(
				matched?.assessment?.determination,
				bag.determination
			);
			const femalePlantsMatches =
				!!matched?.contains_female_plants === !!bag.female_plants;
			items.push({
				label: `Add Bag — original ${bag.original_seal}, new ${bag.new_seal}`,
				expected: details,
				done:
					!!matched &&
					!!matched.assessment?.determination &&
					newSealMatches &&
					contentTypeMatches &&
					determinationMatches &&
					femalePlantsMatches,
			});
		}

		return {
			title:
				brief.forms.length > 1 ? `Priority 3 form ${i + 1}` : "On the form",
			items,
		};
	});
};

/**
 * Per-form certificate checklist for step 3: generate the certificate, then
 * review and mark it ready. One group per brief form so multi-form cases show
 * progress for each certificate.
 */
export const buildCertificateChecklists = (
	brief: IPracticeBrief,
	liveForms: LiveForm[]
): ChecklistGroup[] => {
	return brief.forms.map((_bf, i) => {
		const live = liveForms[i];
		const generated = !!live?.certificate;
		const ready = !!live?.marked_ready;
		return {
			title:
				brief.forms.length > 1
					? `Certificate — form ${i + 1}`
					: "Certificate",
			items: [
				{ label: "Generate the certificate", done: generated },
				{ label: "Review and mark it ready", done: generated && ready },
			],
		};
	});
};

/** Whether every case-level checklist item matches the brief. */
export const isCaseChecklistComplete = (
	brief: IPracticeBrief,
	liveCase: LiveCase | null
): boolean => buildCaseChecklist(brief, liveCase).items.every((i) => i.done);

/**
 * Whether every per-form checklist item is complete — the Priority 3 form is
 * added, its bags recorded and assessed, and any SME entered. Used to advance
 * the guide from "record the samples" to "generate certificates".
 */
export const areFormChecklistsComplete = (
	brief: IPracticeBrief,
	liveForms: LiveForm[]
): boolean => {
	const groups = buildFormChecklists(brief, liveForms);
	return (
		groups.length > 0 &&
		groups.every((g) => g.items.length > 0 && g.items.every((i) => i.done))
	);
};
