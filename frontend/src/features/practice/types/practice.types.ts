/**
 * Types for practice mode.
 */

export interface IPracticeModeState {
	practice_mode: boolean;
	practice_mode_expires_at: string | null;
}

export interface IPracticeBriefBag {
	original_seal: string;
	new_seal: string;
	content_type: string;
	determination: string;
	female_plants: boolean;
}

/** One Priority 3 form within a practice brief: its own SME and drug bags. */
export interface IPracticeBriefForm {
	/** Security movement envelope for this form, or "" if none. */
	security_movement_envelope: string;
	bags: IPracticeBriefBag[];
}

/**
 * A fake Priority 3 brief for the user to work through. The approved botanist is
 * deliberately not part of the brief: a botanist must be a real invited user, so
 * practice always uses the system's default botanist, which is pre-selected on
 * new cases.
 */
export interface IPracticeBrief {
	/** Short label for the example, shown in the sheet. */
	label: string;
	case_number: string;
	officer: {
		rank_display: string;
		badge_number: string;
		given_names: string;
		last_name: string;
		station: string;
	};
	station: string;
	defendant: { given_names: string; last_name: string };
	forms: IPracticeBriefForm[];
}
