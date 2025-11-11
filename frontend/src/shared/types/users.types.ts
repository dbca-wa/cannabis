// User and role types that match Django models exactly
// This file contains police officers, defendants, and related user types

// Forward declaration to avoid circular imports
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

// ============================================================================
// POLICE TYPES (matches Django PoliceStation and PoliceOfficer models)
// ============================================================================

// Officer rank choices (matches PoliceOfficer.SeniorityChoices in Django)
export type OfficerRank =
	| "unknown"
	| "unsworn_officer"
	| "sworn_officer"
	| "constable"
	| "police_constable"
	| "first_class_constable"
	| "senior_constable"
	| "detective"
	| "detective_first_class_constable"
	| "detective_senior_constable"
	| "senior_detective"
	| "sergeant"
	| "inspector"
	| "other";

// Police Station (matches PoliceStationSerializer)
export interface PoliceStation {
	id: number;
	name: string;
	address: string | null;
	phone: string | null;
	officer_count: number; // Computed field from serializer
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Police Station (matches PoliceStationTinySerializer)
export interface PoliceStationTiny {
	id: number;
	name: string;
	phone: string | null;
}

// Police Officer (matches PoliceOfficerSerializer)
export interface PoliceOfficer {
	id: number;
	badge_number: string | null;
	first_name: string | null;
	last_name: string | null;
	full_name: string; // Computed field
	rank: OfficerRank;
	rank_display: string; // Computed field from get_rank_display()
	is_sworn: boolean; // Computed field
	station: number | null; // Foreign key ID
	station_details: PoliceStationTiny | null; // Nested object
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Police Officer (matches PoliceOfficerTinySerializer)
export interface PoliceOfficerTiny {
	id: number;
	badge_number: string | null;
	first_name: string | null; // Added for form pre-selection
	last_name: string | null; // Added for form pre-selection
	full_name: string;
	rank: OfficerRank; // Added rank field for form pre-selection
	rank_display: string;
	station: number | null; // Added station ID for form pre-selection
	station_name: string | null;
	is_sworn: boolean;
}

// Police Station creation request (matches PoliceStationSerializer fields)
export interface PoliceStationCreateRequest {
	name: string;
	address?: string | null;
	phone?: string | null;
}

// Police Station update request (partial update)
export interface PoliceStationUpdateRequest {
	name?: string;
	address?: string | null;
	phone?: string | null;
}

// Police Officer creation request (matches PoliceOfficerCreateSerializer)
export interface PoliceOfficerCreateRequest {
	badge_number?: string | undefined;
	first_name?: string | undefined;
	last_name: string;
	rank: OfficerRank;
	station?: number | undefined;
}

// Police Officer update request (partial update)
export interface PoliceOfficerUpdateRequest {
	badge_number?: string | undefined;
	first_name?: string | undefined;
	last_name?: string;
	rank?: OfficerRank;
	station?: number | undefined;
}

// Paginated police responses
export interface PaginatedPoliceStationsResponse
	extends PaginatedResponse<PoliceStation> {}
export type PaginatedPoliceOfficersResponse =
	PaginatedResponse<PoliceOfficerTiny>;

// Police search parameters
export interface PoliceStationSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	limit?: number;
	offset?: number;
}

export interface PoliceOfficerSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	station?: number; // Filter by station ID
	rank?: OfficerRank; // Filter by rank
	is_sworn?: boolean; // Filter by sworn status
	include_unknown?: boolean; // Include unknown/other ranks
	unknown_only?: boolean; // Show ONLY unknown/other ranks (for data quality review)
	ordering?: string; // Sort order (e.g., 'name', '-rank', 'station')
	limit?: number;
	offset?: number;
}

// Police Officers table filter preferences
export interface OfficersTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	stationFilter?: string; // "all" or station ID as string
	rankFilter?: string; // "all" or specific rank
	swornFilter?: string; // "all", "true", "false"
	includeUnknown?: boolean;
	unknownOnly?: boolean;
}

// Police Stations table filter preferences
export interface StationsTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	// Currently only has sorting, but can be extended
}

// ============================================================================
// DEFENDANTS TYPES (matches Django Defendant model and serializers)
// ============================================================================

// Complete defendant object (matches DefendantSerializer)
export interface Defendant {
	id: number;
	first_name: string | null;
	last_name: string;
	full_name: string; // Computed field
	pdf_name: string; // Computed field
	cases_count: number; // Computed field from serializer
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight defendant (matches DefendantTinySerializer)
export interface DefendantTiny {
	id: number;
	first_name: string | null;
	last_name: string;
	full_name: string; // Computed field
	cases_count: number; // Computed field from serializer
}

// Defendant creation request (matches DefendantSerializer fields)
export interface DefendantCreateRequest {
	first_name?: string | null;
	last_name: string;
}

// Defendant update request (partial update)
export interface DefendantUpdateRequest {
	first_name?: string | null;
	last_name?: string;
}

// Paginated defendants response
export interface PaginatedDefendantsResponse
	extends PaginatedResponse<DefendantTiny> {}

// Defendant search parameters
export interface DefendantSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	ordering?: string; // Sort order (e.g., 'last_name', '-cases_count')
	limit?: number;
	offset?: number;
}

// Defendants table filter preferences
export interface DefendantsTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	// Currently only has sorting, but can be extended for case count filters
}