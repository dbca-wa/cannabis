// Drug bag domain types — matches Django DrugBag model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";
import type { BotanicalAssessment } from "./assessments.types";

// Drug bag content type choices (matches DrugBag.ContentType in Django)
export type DrugBagContentType =
	| "plant"
	| "plant_material"
	| "cutting"
	| "stalk"
	| "stem"
	| "seed"
	| "seed_material"
	| "unknown_seed"
	| "seedling"
	| "head"
	| "rootball"
	| "poppy"
	| "poppy_plant"
	| "poppy_capsule"
	| "poppy_head"
	| "poppy_seed"
	| "mushroom"
	| "tablet"
	| "unknown"
	| "unsure";

// Botanical assessment determination choices (matches BotanicalAssessment.DeterminationChoices)
export type BotanicalDetermination =
	| "pending"
	| "cannabis_sativa"
	| "cannabis_indica"
	| "cannabis_hybrid"
	| "mixed"
	| "papaver_somniferum"
	| "degraded"
	| "not_cannabis"
	| "unidentifiable"
	| "inconclusive";

// Convenience alias used by forms
export type DeterminationType = BotanicalDetermination;

// Drug Bag (matches DrugBagSerializer)
export interface DrugBag {
	id: number;
	case: number;
	content_type: DrugBagContentType;
	content_type_display: string;
	seal_tag_numbers: string;
	new_seal_tag_numbers: string | null;
	property_reference: string | null;
	gross_weight: string | null;
	net_weight: string | null;
	security_movement_envelope: string;
	assessment: BotanicalAssessment | null;
	created_at: string;
	updated_at: string;
}

// Drug bag creation request (matches DrugBagCreateSerializer)
export interface DrugBagCreateRequest {
	case: number;
	content_type: DrugBagContentType;
	seal_tag_numbers: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null;
	net_weight?: string | null;
}

// Drug bag update request (partial update)
export interface DrugBagUpdateRequest {
	content_type?: DrugBagContentType;
	seal_tag_numbers?: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null;
	net_weight?: string | null;
}

// Paginated drug bags response
export type PaginatedDrugBagsResponse = PaginatedResponse<DrugBag>;
