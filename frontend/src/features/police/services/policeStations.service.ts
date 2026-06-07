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
	limit?: number;
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
			limit: params.limit,
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
		return apiClient.get<PoliceStation>(ENDPOINTS.POLICE.STATIONS.DETAIL(id));
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

	/**
	 * Merge secondary stations into a primary station,
	 * transferring all officers and cases to the primary.
	 */
	async mergeStations(
		data: StationMergeRequest
	): Promise<StationMergeResponse> {
		return apiClient.post<StationMergeResponse>(
			ENDPOINTS.POLICE.STATIONS.MERGE,
			data
		);
	},
};

export interface StationMergeRequest {
	primary_id: number;
	secondary_ids: number[];
}

export interface StationMergeResponse {
	message: string;
	primary_id: number;
	officers_reassigned: number;
	cases_reassigned: number;
}
