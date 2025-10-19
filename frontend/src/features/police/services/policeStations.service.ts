import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	PoliceStation,
	PoliceStationCreateRequest,
	PoliceStationUpdateRequest,
	PaginatedResponse,
} from "@/shared/types/backend-api.types";

export interface StationsQueryParams {
	page?: number;
	search?: string;
	ordering?: string;
}

export const policeStationsService = {
	/**
	 * Get paginated list of police stations
	 */
	async getStations(
		params: StationsQueryParams = {}
	): Promise<PaginatedResponse<PoliceStation>> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.POLICE.STATIONS.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;
		return apiClient.get<PaginatedResponse<PoliceStation>>(url);
	},

	/**
	 * Get a single police station by ID
	 */
	async getStation(id: number): Promise<PoliceStation> {
		return apiClient.get<PoliceStation>(
			ENDPOINTS.POLICE.STATIONS.DETAIL(id)
		);
	},

	/**
	 * Create a new police station
	 */
	async createStation(
		data: PoliceStationCreateRequest
	): Promise<PoliceStation> {
		return apiClient.post<PoliceStation>(
			ENDPOINTS.POLICE.STATIONS.CREATE,
			data
		);
	},

	/**
	 * Update an existing police station
	 */
	async updateStation(
		id: number,
		data: PoliceStationUpdateRequest
	): Promise<PoliceStation> {
		return apiClient.put<PoliceStation>(
			ENDPOINTS.POLICE.STATIONS.UPDATE(id),
			data
		);
	},

	/**
	 * Delete a police station
	 */
	async deleteStation(id: number): Promise<void> {
		return apiClient.delete(ENDPOINTS.POLICE.STATIONS.DELETE(id));
	},

	/**
	 * Export all police stations data (bypasses pagination)
	 */
	async exportStations(
		format: "csv" | "json" = "csv",
		params: Omit<StationsQueryParams, "page"> = {}
	): Promise<Blob> {
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("format", format);

		// Add filtering parameters (but not pagination)
		if (params.search) searchParams.append("search", params.search);
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.POLICE.STATIONS.EXPORT}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		return apiClient.getBlob(url);
	},
};
