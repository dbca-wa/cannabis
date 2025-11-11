// Re-export defendant types from shared types
export type {
	Defendant,
	DefendantTiny,
	DefendantCreateRequest,
	DefendantUpdateRequest,
	PaginatedDefendantsResponse,
	DefendantSearchParams,
} from "@/shared/types/backend-api.types";

// Re-export form data types from schemas
export type {
	CreateDefendantFormData,
	EditDefendantFormData,
} from "../schemas";
