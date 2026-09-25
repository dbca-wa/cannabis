import type { Priority3Form } from "@/shared/types/backend-api.types";
import { isFormStale } from "./certificateStaleness";

/**
 * Sections of the case processing page, in the order they are rendered.
 *
 * The identifier doubles as the anchor id used by the section index, so it must
 * stay URL-fragment safe.
 */
export const CASE_SECTIONS = [
	{
		id: "details",
		label: "Case Details",
		description: "Reference, dates, defendants and officers",
	},
	{
		id: "assessment",
		label: "Priority Form Assessment",
		description: "Priority 3 forms and their drug bags",
	},
	{
		id: "certificates",
		label: "Certificates",
		description: "Generate and review each form's certificate",
	},
] as const;

export type CaseSectionId = (typeof CASE_SECTIONS)[number]["id"];

/** Whether each section holds complete, valid data. */
export interface CaseSectionValidity {
	details: boolean;
	assessment: boolean;
	certificates: boolean;
}

/**
 * Intermediate flags behind the section validity, exposed so the page can
 * explain to the user precisely what is outstanding rather than only that a
 * section is incomplete.
 */
export interface CaseSectionFlags extends CaseSectionValidity {
	/** No forms exist yet, or every form holds at least one bag. */
	allFormsHaveBags: boolean;
	/** At least one form exists and every bag on every form has a determination. */
	allBagsAssessed: boolean;
	/** At least one form exists and every form has a generated certificate. */
	allFormsHaveCerts: boolean;
	/** A generated certificate no longer matches its bag data. */
	certificatesStale: boolean;
	/** At least one form exists. */
	hasForms: boolean;
}

type BagWithAssessment = {
	assessment?: { determination?: string | null } | null;
};

/** A bag counts as assessed once it carries a determination other than pending. */
const isBagAssessed = (bag: BagWithAssessment): boolean =>
	!!bag.assessment?.determination && bag.assessment.determination !== "pending";

/**
 * Derive the completion state of every case processing section.
 *
 * Assessment and certificate validity are deliberately case-level rather than
 * form-level: a case is only ready to finalise when every one of its forms is
 * ready, so viewing one complete form must not report the whole section done.
 *
 * @param caseData - Server case data merged with the active form
 * @param forms - Every Priority 3 form on the case
 */
export const deriveCaseSectionFlags = (
	caseData: Record<string, unknown> | null,
	forms: readonly Priority3Form[] | undefined
): CaseSectionFlags => {
	const details = !!(
		caseData &&
		(caseData.case_number as string)?.trim() &&
		(caseData.received as string)?.trim() &&
		caseData.submitting_officer_id &&
		caseData.approved_botanist_id
	);

	const hasForms = !!forms && forms.length > 0;

	// With no forms yet there is nothing failing the bag check — the missing
	// piece is the form itself, which `hasForms` reports.
	const allFormsHaveBags =
		!forms || forms.length === 0
			? true
			: forms.every((form) => (form.bags?.length ?? 0) > 0);

	const allBagsAssessed =
		hasForms &&
		forms!.every((form) => {
			const bags = (form.bags ?? []) as BagWithAssessment[];
			return bags.length > 0 && bags.every(isBagAssessed);
		});

	const allFormsHaveCerts =
		hasForms && forms!.every((form) => !!form.certificate);

	// A certificate whose bag data changed after it was generated is out of date
	// and must be regenerated before the case can be finalised.
	const certificatesStale = hasForms && forms!.some(isFormStale);

	return {
		details,
		// Section C notes are not required — they default to "None".
		assessment: allFormsHaveBags && allBagsAssessed,
		// A stale certificate is not a finished certificate.
		certificates: allFormsHaveCerts && !certificatesStale,
		allFormsHaveBags,
		allBagsAssessed,
		allFormsHaveCerts,
		certificatesStale,
		hasForms,
	};
};

/** The first section that is not yet complete, or null when all are. */
export const firstIncompleteSection = (
	validity: CaseSectionValidity
): CaseSectionId | null =>
	CASE_SECTIONS.find((section) => !validity[section.id])?.id ?? null;

/**
 * How a section should present itself.
 *
 * - `complete`   — holds everything it needs
 * - `attention`  — has been started but something required is missing or wrong
 * - `notStarted` — nothing to report yet, because the work it depends on has
 *                  not begun
 *
 * The distinction matters: an empty case has no forms, so the assessment and
 * certificate sections are not *wrong*, they are simply not reachable yet.
 * Colouring them red on a brand new case would cry wolf.
 */
export type CaseSectionState =
	"complete" | "attention" | "outOfDate" | "notStarted";

/** Derive the presentation state of every section from one set of flags. */
export const deriveCaseSectionStates = (
	flags: CaseSectionFlags
): Record<CaseSectionId, CaseSectionState> => ({
	// Every field behind the details section is required, so anything missing
	// needs attention immediately.
	details: flags.details ? "complete" : "attention",

	assessment: flags.assessment
		? "complete"
		: flags.hasForms
			? "attention"
			: "notStarted",

	// Certificates cannot be generated until the assessment is finished, so
	// they only ask for attention once it is. A generated-but-stale certificate
	// is its own state: not incomplete, but out of date and needing regeneration.
	certificates: flags.certificates
		? "complete"
		: flags.certificatesStale
			? "outOfDate"
			: flags.assessment
				? "attention"
				: "notStarted",
});

/** Plain-language reason a section is not complete, for a tooltip or hint. */
export const describeSectionState = (
	sectionId: CaseSectionId,
	flags: CaseSectionFlags
): string | null => {
	if (sectionId === "details") {
		return flags.details ? null : "Some required case details are missing";
	}

	if (sectionId === "assessment") {
		if (flags.assessment) return null;
		if (!flags.hasForms) return "Add a Priority 3 form to begin";
		if (!flags.allFormsHaveBags) return "Every form needs at least one bag";
		return "Every bag needs a determination";
	}

	if (flags.certificates) return null;
	if (flags.certificatesStale)
		return "A certificate is out of date — regenerate it";
	if (!flags.hasForms) return "Add a Priority 3 form to begin";
	if (!flags.assessment) return "Finish the assessment first";
	return "Every form needs a generated certificate";
};
