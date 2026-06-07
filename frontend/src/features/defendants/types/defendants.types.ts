// Defendant domain types — matches Django Defendant model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

// Complete defendant object (matches DefendantSerializer)
export interface Defendant {
	id: number;
	given_names: string | null;
	last_name: string;
	full_name: string;
	pdf_name: string;
	cases_count: number;
	created_at: string;
	updated_at: string;
}

// Lightweight defendant (matches DefendantTinySerializer)
export interface DefendantTiny {
	id: number;
	given_names: string | null;
	last_name: string;
	full_name: string;
	cases_count: number;
}

// Defendant creation request (matches DefendantSerializer fields)
export interface DefendantCreateRequest {
	given_names?: string | null;
	last_name: string;
}

// Defendant update request (partial update)
export interface DefendantUpdateRequest {
	given_names?: string | null;
	last_name?: string;
}

// Paginated defendants response
export type PaginatedDefendantsResponse = PaginatedResponse<DefendantTiny>;

// Defendant search parameters
export interface DefendantSearchParams {
	search?: string;
	ordering?: string;
	limit?: number;
	offset?: number;
}
