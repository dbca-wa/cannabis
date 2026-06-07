// Defendant feature types — canonical definitions
export type {
	Defendant,
	DefendantTiny,
	DefendantCreateRequest,
	DefendantUpdateRequest,
	PaginatedDefendantsResponse,
	DefendantSearchParams,
} from "./defendants.types";

// Re-export form data types from schemas
export type {
	CreateDefendantFormData,
	EditDefendantFormData,
} from "../schemas";
