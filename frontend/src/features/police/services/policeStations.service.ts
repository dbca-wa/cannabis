import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { logger } from "@/shared/services/logger.service";
import type {
	PoliceStation,
	PoliceStationCreateRequest,
	PoliceStationUpdateRequest,
	PaginatedResponse,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";

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
		const cleanParams = buildQueryParams({
			page: params.page,
			search: params.search,
			ordering: params.ordering,
		});

		return apiClient.get<PaginatedResponse<PoliceStation>>(
			ENDPOINTS.POLICE.STATIONS.LIST,
			{ params: cleanParams }
		);
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
		const result = await apiClient.post<PoliceStation>(
			ENDPOINTS.POLICE.STATIONS.CREATE,
			data
		);
		logger.debug("createStation service response", { result });
		return result;
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
		const cleanParams = buildQueryParams({
			format: format,
			search: params.search,
			ordering: params.ordering,
		});

		const searchParams = new URLSearchParams();
		Object.entries(cleanParams).forEach(([key, value]) => {
			searchParams.append(key, String(value));
		});

		const url = `${
			ENDPOINTS.POLICE.STATIONS.EXPORT
		}?${searchParams.toString()}`;

		return apiClient.getBlob(url);
	},
};
