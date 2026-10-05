/**
 * Hardcoded practice briefs.
 *
 * Edit this array to add or change the fake Priority 3 examples offered in
 * practice mode. One brief is chosen per practice session and kept stable for
 * that session. The approved botanist is never part of a brief — practice always
 * uses the system default botanist, since a botanist must be a real invited user.
 *
 * Determinations use only the going-forward set: cannabis_sativa, degraded,
 * inconclusive, not_cannabis. Content types match the form's options
 * (plant, plant_material, seed, cutting, ...).
 */
import type { IPracticeBrief } from "../types/practice.types";

export const PRACTICE_BRIEFS: IPracticeBrief[] = [
	{
		label: "Single form, three bags",
		case_number: "PRACTICE-480021",
		officer: {
			rank_display: "Senior Constable",
			badge_number: "PD51021",
			given_names: "Alex",
			last_name: "Turner",
			station: "Fremantle",
		},
		station: "Fremantle",
		defendant: { given_names: "Chris", last_name: "Nguyen" },
		forms: [
			{
				security_movement_envelope: "",
				bags: [
					{
						original_seal: "T10041",
						new_seal: "N20041",
						content_type: "plant",
						determination: "cannabis_sativa",
						female_plants: true,
					},
					{
						original_seal: "T10042",
						new_seal: "N20042",
						content_type: "plant_material",
						determination: "cannabis_sativa",
						female_plants: false,
					},
					{
						original_seal: "T10043",
						new_seal: "N20043",
						content_type: "seed",
						determination: "not_cannabis",
						female_plants: false,
					},
				],
			},
		],
	},
	{
		label: "Two forms, one with an envelope",
		case_number: "PRACTICE-480114",
		officer: {
			rank_display: "Sergeant",
			badge_number: "PD60198",
			given_names: "Sam",
			last_name: "Patel",
			station: "Joondalup",
		},
		station: "Joondalup",
		defendant: { given_names: "Taylor", last_name: "O'Brien" },
		forms: [
			{
				security_movement_envelope: "",
				bags: [
					{
						original_seal: "T33501",
						new_seal: "N41501",
						content_type: "plant",
						determination: "cannabis_sativa",
						female_plants: true,
					},
					{
						original_seal: "T33502",
						new_seal: "N41502",
						content_type: "plant",
						determination: "degraded",
						female_plants: false,
					},
				],
			},
			{
				security_movement_envelope: "SME77421",
				bags: [
					{
						original_seal: "T33510",
						new_seal: "N41510",
						content_type: "plant_material",
						determination: "inconclusive",
						female_plants: false,
					},
				],
			},
		],
	},
];

const SESSION_KEY = "practice-brief-index";

/**
 * The brief for the current practice session. The chosen index is stored in
 * sessionStorage so it stays the same while the user works, and rotates to a new
 * example on the next session.
 */
export const getPracticeBriefIndex = (): number => {
	const stored = sessionStorage.getItem(SESSION_KEY);
	let index = stored === null ? NaN : Number(stored);
	if (
		!Number.isInteger(index) ||
		index < 0 ||
		index >= PRACTICE_BRIEFS.length
	) {
		index = Math.floor(Math.random() * PRACTICE_BRIEFS.length);
		sessionStorage.setItem(SESSION_KEY, String(index));
	}
	return index;
};

/** Persist the chosen brief index (used by the prev/next controls). */
export const setPracticeBriefIndex = (index: number): void => {
	const n = PRACTICE_BRIEFS.length;
	const clamped = ((index % n) + n) % n;
	sessionStorage.setItem(SESSION_KEY, String(clamped));
};

export const getSessionPracticeBrief = (): IPracticeBrief =>
	PRACTICE_BRIEFS[getPracticeBriefIndex()];
