/**
 * Botanical determinations: the results a botanist can choose, and labels for
 * every value the backend stores.
 *
 * Only the four approved results can print on a certificate. Legacy values
 * imported from the old system keep their label for display but are never
 * offered for selection. Labels match BotanicalAssessment.DeterminationChoices.
 */
import type { BotanicalDetermination } from "../types/drugBags.types";

/** Every stored value's label, including legacy values kept for old records. */
export const DETERMINATION_LABELS: Record<BotanicalDetermination, string> = {
	pending: "Pending Assessment",
	cannabis_sativa: "Cannabis sativa",
	not_cannabis: "Not Cannabis",
	degraded: "Too degraded and could not be identified",
	inconclusive: "Inconclusive",
	cannabis_indica: "Cannabis indica",
	cannabis_hybrid: "Cannabis (hybrid)",
	mixed: "Mixed",
	papaver_somniferum: "Papaver somniferum",
	unidentifiable: "Unidentifiable",
};

/** The results that may print on a certificate. */
export const PRINTABLE_DETERMINATIONS = [
	"cannabis_sativa",
	"not_cannabis",
	"degraded",
	"inconclusive",
] as const satisfies readonly BotanicalDetermination[];

export type PrintableDetermination = (typeof PRINTABLE_DETERMINATIONS)[number];

/** Options shown when recording a result: pending first, then the four results. */
export const DETERMINATION_OPTIONS: {
	value: BotanicalDetermination;
	label: string;
}[] = (["pending", ...PRINTABLE_DETERMINATIONS] as const).map((value) => ({
	value,
	label: DETERMINATION_LABELS[value],
}));

/** Help text shown beside the result selector. */
export const DETERMINATION_HELP =
	"Choose Inconclusive when the sample was insufficient or could not be identified.";

/** Label for any stored value, falling back to the value itself. */
export const getDeterminationLabel = (value: string): string =>
	DETERMINATION_LABELS[value as BotanicalDetermination] ?? value;

export const isPrintableDetermination = (
	value: string | null | undefined
): value is PrintableDetermination =>
	!!value && (PRINTABLE_DETERMINATIONS as readonly string[]).includes(value);

/** True for any cannabis result, including legacy cannabis values. */
export const isCannabisDetermination = (
	value: string | null | undefined
): boolean =>
	value === "cannabis_sativa" ||
	value === "cannabis_indica" ||
	value === "cannabis_hybrid" ||
	value === "mixed";
