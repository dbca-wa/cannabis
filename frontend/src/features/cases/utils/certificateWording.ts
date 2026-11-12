/**
 * Certificate wording for the live preview: Section B, the automatic Section C
 * lines and the officers.
 *
 * Mirrors backend/cases/services/certificate_wording.py line for line, so the
 * preview prints exactly what the PDF will. Both test suites check their code
 * against backend/cases/tests/fixtures/certificate_wording.json, which holds
 * the expected output for every combination. After changing wording here or
 * in Python, run `poetry run python manage.py build_certificate_wording_fixture`.
 */
import { joinWithAnd } from "@/shared/utils/certificate-format.utils";
import {
	isPrintableDetermination,
	type PrintableDetermination,
} from "../constants/determinations";

export const SPECIES = "Cannabis sativa";

/** Section C line for each bag Section B does not describe. */
export const BAG_LINE_PHRASES: Record<
	Exclude<PrintableDetermination, "cannabis_sativa">,
	string
> = {
	not_cannabis: "did not contain Cannabis",
	degraded: "was too degraded and could not be identified",
	inconclusive: "was inconclusive",
};

export type SectionBKey = PrintableDetermination | "mixed_not_cannabis";

type Wording = [prefix: string, italic: string, suffix: string];

/** Section B as [prefix, italic, suffix], for one bag and for several. */
export const SECTION_B_WORDING: Record<
	SectionBKey,
	{ one: Wording; many: Wording }
> = {
	cannabis_sativa: {
		one: ["I identified the item as ", SPECIES, "."],
		many: ["I identified the items as ", SPECIES, "."],
	},
	not_cannabis: {
		one: ["The item did not contain Cannabis.", "", ""],
		many: ["The items did not contain Cannabis.", "", ""],
	},
	degraded: {
		one: ["The item was too degraded and could not be identified.", "", ""],
		many: ["The items were too degraded and could not be identified.", "", ""],
	},
	inconclusive: {
		one: ["The item was inconclusive.", "", ""],
		many: ["The items were inconclusive.", "", ""],
	},
	mixed_not_cannabis: {
		one: ["No item could be identified as ", SPECIES, "."],
		many: ["No item could be identified as ", SPECIES, "."],
	},
};

export interface SectionB {
	key: SectionBKey;
	prefix: string;
	/** The only italicised part: the species name, or "" */
	italic: string;
	suffix: string;
}

export interface CertificateResults {
	sectionB: SectionB;
	bagLines: string[];
}

export interface BagResult {
	tag: string;
	determination: string | null | undefined;
}

export const bagLine = (
	tag: string,
	determination: Exclude<PrintableDetermination, "cannabis_sativa">
): string => `Bag ${tag} ${BAG_LINE_PHRASES[determination]}.`;

export const sectionBText = (sectionB: SectionB): string =>
	`${sectionB.prefix}${sectionB.italic}${sectionB.suffix}`;

/**
 * Work out Section B and the automatic Section C lines for a form, or null
 * when any bag has no printable result yet (the preview shows "[Pending]").
 *
 * - Any Cannabis sativa bag: the cannabis sentence, and a line for every
 *   other bag.
 * - No cannabis, one shared result: that result's sentence, no lines.
 * - No cannabis, differing results: "No item could be identified as
 *   Cannabis sativa.", and a line for every bag.
 */
export const summariseResults = (
	bags: BagResult[]
): CertificateResults | null => {
	if (bags.length === 0) return null;
	if (!bags.every((b) => isPrintableDetermination(b.determination))) {
		return null;
	}
	const printable = bags as Array<{
		tag: string;
		determination: PrintableDetermination;
	}>;
	const results = printable.map((b) => b.determination);

	let key: SectionBKey;
	let listed: typeof printable;
	if (results.includes("cannabis_sativa")) {
		key = "cannabis_sativa";
		listed = printable.filter((b) => b.determination !== "cannabis_sativa");
	} else if (new Set(results).size === 1) {
		key = results[0];
		listed = [];
	} else {
		key = "mixed_not_cannabis";
		listed = printable;
	}

	const [prefix, italic, suffix] =
		SECTION_B_WORDING[key][bags.length === 1 ? "one" : "many"];
	return {
		sectionB: { key, prefix, italic, suffix },
		bagLines: listed.map((b) =>
			bagLine(
				b.tag,
				b.determination as Exclude<PrintableDetermination, "cannabis_sativa">
			)
		),
	};
};

export const FEMALE_PHRASE = "contained female plants";
export const ALL_FEMALE_LINE = `All bags ${FEMALE_PHRASE}.`;

export interface FemaleBag {
	tag: string;
	determination: string | null | undefined;
	female: boolean | null | undefined;
}

/**
 * The Section C female plant sentence for a form, or null. Only Cannabis
 * sativa bags count. Reads "All bags contained female plants." when every bag
 * on a form of two or more does; otherwise names them.
 */
export const femalePlantLine = (bags: FemaleBag[]): string | null => {
	const tags = bags
		.filter((b) => b.female && b.determination === "cannabis_sativa")
		.map((b) => b.tag);
	if (tags.length === 0) return null;
	if (tags.length === bags.length && bags.length > 1) return ALL_FEMALE_LINE;
	return `${tags.length === 1 ? "Bag" : "Bags"} ${joinWithAnd(tags)} ${FEMALE_PHRASE}.`;
};

const comparable = (line: string): string => {
	const text = line.trim().toLowerCase();
	return text.endsWith(".") ? text.slice(0, -1) : text;
};

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SYSTEM_SENTENCE = new RegExp(
	"^(?:bags? \\S.* (?:" +
		[...Object.values(BAG_LINE_PHRASES), FEMALE_PHRASE]
			.map((phrase) => escapeRegExp(phrase.toLowerCase()))
			.join("|") +
		")|all bags " +
		escapeRegExp(FEMALE_PHRASE) +
		")$"
);

/**
 * True for a bag result or female plant sentence the system writes. Such a
 * sentence in the note is always superseded by the one worked out from the
 * current bags, so a stale copy can never contradict the certificate.
 */
export const isSystemSentence = (line: string): boolean =>
	SYSTEM_SENTENCE.test(comparable(line));

export const SME_PHRASE = "Subsamples placed into Security Movement Envelope";

const SME_SENTENCE = new RegExp(
	"^" + escapeRegExp(SME_PHRASE.toLowerCase()) + " \\S.*$"
);

/**
 * The Section C envelope sentence for a form, or null when none is set, e.g.
 * "Subsamples placed into Security Movement Envelope WW1.".
 */
export const smeLine = (envelope: string | null | undefined): string | null => {
	const value = (envelope ?? "").trim();
	if (!value) return null;
	return `${SME_PHRASE} ${value.endsWith(".") ? value.slice(0, -1) : value}.`;
};

/** True for a note line naming the envelope in the system's own words. */
export const isSmeSentence = (line: string): boolean =>
	SME_SENTENCE.test(comparable(line));

const trimBlankEnds = (lines: string[]): string[] => {
	let start = 0;
	let end = lines.length;
	while (start < end && !lines[start]) start++;
	while (end > start && !lines[end - 1]) end--;
	return lines.slice(start, end);
};

/**
 * Join the automatic lines and the botanist's note for Section C.
 *
 * Order: the bag result lines, the envelope sentence, the botanist's note,
 * then the female plant sentence. Any note line that is itself a bag result or
 * female plant sentence (ignoring case, surrounding spaces and a trailing full
 * stop) is dropped, because the system writes those from the current bags.
 * When the form has an envelope, a note line naming an envelope in the same
 * words is dropped too; without one, such a line is the only record of the
 * envelope and is kept. Returns null when there is nothing to print, which the
 * certificate shows as "None".
 */
export const composeSectionC = (
	bagLines: string[],
	note: string | null | undefined,
	femaleLine: string | null = null,
	envelopeLine: string | null = null
): string | null => {
	const noteLines = trimBlankEnds(
		(note ?? "")
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.split("\n")
			.map((line) => line.trim())
	);
	const kept = trimBlankEnds(
		noteLines.filter(
			(line) =>
				!isSystemSentence(line) && !(envelopeLine && isSmeSentence(line))
		)
	);
	const lines = [
		...bagLines,
		...(envelopeLine ? [envelopeLine] : []),
		...kept,
		...(femaleLine ? [femaleLine] : []),
	];
	return lines.length > 0 ? lines.join("\n") : null;
};

export type OfficerRole = "conveying" | "requesting";

/** The officer details the certificate prints. */
export interface OfficerFacts {
	badge_number?: string | null;
	last_name?: string | null;
	given_names?: string | null;
	rank?: string | null;
	rank_display?: string | null;
	station_name?: string | null;
}

/** Rank values that are not a real police rank, so never replace the label. */
export const UNRECORDED_RANKS = new Set(["unknown", "other"]);

export const hasRecordedRank = (rank: string | null | undefined): boolean =>
	!!rank && !UNRECORDED_RANKS.has(rank);

/**
 * Format an officer as the certificate names them:
 * `<label> <badge> <SURNAME>, <Given names>[ of <station>]`.
 *
 * The conveying officer is always "Unsworn Officer". The requesting officer is
 * "Sworn Officer", or their rank when printRank is set and they have one on
 * record. The station is added only when printStation is set and the officer
 * has one. Missing parts are left out.
 */
export const formatOfficer = (
	officer: OfficerFacts | null | undefined,
	options: { role: OfficerRole; printStation: boolean; printRank?: boolean }
): string => {
	if (!officer) return "[Pending]";
	const label =
		options.role === "conveying"
			? "Unsworn Officer"
			: options.printRank &&
				  hasRecordedRank(officer.rank) &&
				  officer.rank_display
				? officer.rank_display
				: "Sworn Officer";

	const parts = [label];
	if (officer.badge_number) parts.push(officer.badge_number);
	if (officer.last_name) parts.push(officer.last_name.toUpperCase());
	let text = parts.join(" ");
	if (officer.given_names) text += `, ${officer.given_names}`;
	if (options.printStation && officer.station_name) {
		text += ` of ${officer.station_name}`;
	}
	return text;
};

/** The case's print options, falling back to the backend defaults. */
export interface PrintOptions {
	printConveyingStation: boolean;
	printRequestingStation: boolean;
	printRequestingRank: boolean;
}

export const readPrintOptions = (
	caseData: Record<string, unknown> | null | undefined
): PrintOptions => ({
	printConveyingStation:
		(caseData?.print_conveying_station as boolean | undefined) ?? true,
	printRequestingStation:
		(caseData?.print_requesting_station as boolean | undefined) ?? true,
	printRequestingRank:
		(caseData?.print_requesting_rank as boolean | undefined) ?? false,
});
