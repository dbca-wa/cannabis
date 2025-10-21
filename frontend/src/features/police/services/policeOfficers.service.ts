import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	PoliceOfficer,
	PoliceOfficerCreateRequest,
	PoliceOfficerUpdateRequest,
	PaginatedPoliceOfficersResponse,
	PoliceOfficerSearchParams,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";

/**
 * Police Officers Service
 * Handles all CRUD operations for police officers
 */
export const policeOfficersService = {
	/**
	 * Get paginated list of police officers with optional search and filtering
	 */
	async getOfficers(
		params: PoliceOfficerSearchParams = {}
	): Promise<PaginatedPoliceOfficersResponse> {
		const cleanParams = buildQueryParams({
			search: params.search,
			station: params.station,
			rank: params.rank,
			is_sworn: params.is_sworn,
			include_unknown: params.include_unknown,
			unknown_only: params.unknown_only,
			ordering: params.ordering,
			limit: params.limit,
			offset: params.offset,
		});

		return apiClient.get<PaginatedPoliceOfficersResponse>(
			ENDPOINTS.POLICE.OFFICERS.LIST,
			{ params: cleanParams }
		);
	},

	/**
	 * Get a single police officer by ID
	 */
	async getOfficer(id: number): Promise<PoliceOfficer> {
		return apiClient.get<PoliceOfficer>(
			ENDPOINTS.POLICE.OFFICERS.DETAIL(id)
		);
	},

	/**
	 * Create a new police officer
	 */
	async createOfficer(
		data: PoliceOfficerCreateRequest
	): Promise<PoliceOfficer> {
		return apiClient.post<PoliceOfficer>(
			ENDPOINTS.POLICE.OFFICERS.CREATE,
			data
		);
	},

	/**
	 * Update an existing police officer
	 */
	async updateOfficer(
		id: number,
		data: PoliceOfficerUpdateRequest
	): Promise<PoliceOfficer> {
		return apiClient.put<PoliceOfficer>(
			ENDPOINTS.POLICE.OFFICERS.UPDATE(id),
			data
		);
	},

	/**
	 * Delete a police officer
	 */
	async deleteOfficer(id: number): Promise<void> {
		return apiClient.delete<void>(ENDPOINTS.POLICE.OFFICERS.DELETE(id));
	},

	/**
	 * Export all police officers data (bypasses pagination)
	 */
	async exportOfficers(
		format: "csv" | "json" = "csv",
		params: Omit<PoliceOfficerSearchParams, "limit" | "offset"> = {}
	): Promise<Blob> {
		const cleanParams = buildQueryParams({
			format: format,
			search: params.search,
			station: params.station,
			rank: params.rank,
			is_sworn: params.is_sworn,
			include_unknown: params.include_unknown,
			unknown_only: params.unknown_only,
			ordering: params.ordering,
		});

		const searchParams = new URLSearchParams();
		Object.entries(cleanParams).forEach(([key, value]) => {
			searchParams.append(key, String(value));
		});

		const url = `${
			ENDPOINTS.POLICE.OFFICERS.EXPORT
		}?${searchParams.toString()}`;

		return apiClient.getBlob(url);
	},
};
