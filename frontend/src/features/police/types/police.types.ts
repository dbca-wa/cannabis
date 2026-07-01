// Police domain types — matches Django PoliceStation and PoliceOfficer models

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

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
	officer_count: number;
	case_count?: number;
	created_at: string;
	updated_at: string;
}

// Lightweight Police Station (matches PoliceStationTinySerializer)
export interface PoliceStationTiny {
	id: number;
	name: string;
	phone: string | null;
	address: string;
	postcode: string;
}

// Police Officer (matches PoliceOfficerSerializer)
export interface PoliceOfficer {
	id: number;
	badge_number: string | null;
	given_names: string | null;
	last_name: string | null;
	full_name: string;
	rank: OfficerRank;
	rank_display: string;
	is_sworn: boolean;
	station: number | null;
	station_details: PoliceStationTiny | null;
	created_at: string;
	updated_at: string;
}

// Lightweight Police Officer (matches PoliceOfficerTinySerializer)
export interface PoliceOfficerTiny {
	id: number;
	badge_number: string | null;
	given_names: string | null;
	last_name: string | null;
	full_name: string;
	rank: OfficerRank;
	rank_display: string;
	station: number | null;
	station_name: string | null;
	email: string;
	is_sworn: boolean;
	case_count?: number;
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
	given_names?: string | undefined;
	last_name: string;
	rank: OfficerRank;
	station?: number | undefined;
}

// Police Officer update request (partial update)
export interface PoliceOfficerUpdateRequest {
	badge_number?: string | undefined;
	given_names?: string | undefined;
	last_name?: string;
	rank?: OfficerRank;
	station?: number | undefined;
}

// Paginated police responses
export type PaginatedPoliceStationsResponse = PaginatedResponse<PoliceStation>;
export type PaginatedPoliceOfficersResponse =
	PaginatedResponse<PoliceOfficerTiny>;

// Police search parameters
export interface PoliceStationSearchParams {
	search?: string;
	limit?: number;
	offset?: number;
}

export interface PoliceOfficerSearchParams {
	search?: string;
	station?: number;
	rank?: OfficerRank;
	is_sworn?: boolean;
	include_unknown?: boolean;
	unknown_only?: boolean;
	ordering?: string;
	page?: number;
	limit?: number;
	offset?: number;
}
