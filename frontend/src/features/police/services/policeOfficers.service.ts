import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	PoliceOfficer,
	PoliceOfficerCreateRequest,
	PoliceOfficerUpdateRequest,
	PaginatedPoliceOfficersResponse,
	PoliceOfficerSearchParams,
} from "@/shared/types/backend-api.types";

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
		const searchParams = new URLSearchParams();

		// Add search parameter if provided
		if (params.search && params.search.trim()) {
			searchParams.append("search", params.search.trim());
		}

		// Add station filter if provided
		if (params.station) {
			searchParams.append("station", params.station.toString());
		}

		// Add rank filter if provided
		if (params.rank) {
			searchParams.append("rank", params.rank);
		}

		// Add sworn status filter if provided
		if (params.is_sworn !== undefined) {
			searchParams.append("is_sworn", params.is_sworn.toString());
		}

		// Add include_unknown parameter
		if (params.include_unknown !== undefined) {
			searchParams.append(
				"include_unknown",
				params.include_unknown.toString()
			);
		}

		// Add unknown_only parameter
		if (params.unknown_only !== undefined) {
			searchParams.append("unknown_only", params.unknown_only.toString());
		}

		// Add ordering parameter
		if (params.ordering) {
			searchParams.append("ordering", params.ordering);
		}

		// Add pagination parameters
		if (params.limit) {
			searchParams.append("limit", params.limit.toString());
		}
		if (params.offset) {
			searchParams.append("offset", params.offset.toString());
		}

		const queryString = searchParams.toString();
		const url = queryString
			? `${ENDPOINTS.POLICE.OFFICERS.LIST}?${queryString}`
			: ENDPOINTS.POLICE.OFFICERS.LIST;

		return apiClient.get<PaginatedPoliceOfficersResponse>(url);
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
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("format", format);

		// Add filtering parameters (but not pagination)
		if (params.search && params.search.trim()) {
			searchParams.append("search", params.search.trim());
		}
		if (params.station) {
			searchParams.append("station", params.station.toString());
		}
		if (params.rank) {
			searchParams.append("rank", params.rank);
		}
		if (params.is_sworn !== undefined) {
			searchParams.append("is_sworn", params.is_sworn.toString());
		}
		if (params.include_unknown !== undefined) {
			searchParams.append(
				"include_unknown",
				params.include_unknown.toString()
			);
		}
		if (params.unknown_only !== undefined) {
			searchParams.append("unknown_only", params.unknown_only.toString());
		}
		if (params.ordering) {
			searchParams.append("ordering", params.ordering);
		}

		const url = `${ENDPOINTS.POLICE.OFFICERS.EXPORT}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		return apiClient.getBlob(url);
	},
};
