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

export interface IPracticeBrief {
	case_number: string;
	officer: {
		rank: string;
		rank_display: string;
		badge_number: string;
		given_names: string;
		last_name: string;
		station: string;
	};
	station: string;
	defendant: { given_names: string; last_name: string };
	botanist: { given_names: string; last_name: string };
	security_movement_envelope: string;
	bags: IPracticeBriefBag[];
}
