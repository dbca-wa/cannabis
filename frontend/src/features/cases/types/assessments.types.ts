// Botanical assessment types — matches Django BotanicalAssessment model

import type { BotanicalDetermination } from "./drugBags.types";

// Botanical Assessment (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessment {
	id: number;
	determination: BotanicalDetermination | null;
	determination_display: string;
	is_cannabis: boolean;
	assessment_date: string | null;
	botanist_notes: string | null;
	created_at: string;
	updated_at: string;
}

// Botanical assessment creation/update request (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessmentRequest {
	determination?: BotanicalDetermination | null;
	assessment_date?: string | null;
	botanist_notes?: string | null;
}
