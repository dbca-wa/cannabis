import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Defendant,
	DefendantCreateRequest,
	DefendantUpdateRequest,
	PaginatedDefendantsResponse,
	DefendantSearchParams,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";

export interface DefendantsQueryParams {
	page?: number;
	search?: string;
	ordering?: string;
	limit?: number;
}

export interface DefendantMergeRequest {
	primary_id: number;
	secondary_ids: number[];
}

export interface DefendantMergeResponse {
	message: string;
	primary_id: number;
	cases_reassigned: number;
}

/** Get paginated list of defendants */
export const getDefendants = async (
	params: DefendantsQueryParams = {}
): Promise<PaginatedDefendantsResponse> => {
	const cleanParams = buildQueryParams({
		page: params.page,
		search: params.search,
		ordering: params.ordering,
		limit: params.limit,
	});

	return apiClient.get<PaginatedDefendantsResponse>(ENDPOINTS.DEFENDANTS.LIST, {
		params: cleanParams,
	});
};

/** Get a single defendant by ID */
export const getDefendantById = async (id: number): Promise<Defendant> => {
	return apiClient.get<Defendant>(ENDPOINTS.DEFENDANTS.DETAIL(id));
};

/** Create a new defendant */
export const createDefendant = async (
	data: DefendantCreateRequest
): Promise<Defendant> => {
	return apiClient.post<Defendant>(ENDPOINTS.DEFENDANTS.CREATE, data);
};

/** Update an existing defendant */
export const updateDefendant = async (
	id: number,
	data: DefendantUpdateRequest
): Promise<Defendant> => {
	return apiClient.put<Defendant>(ENDPOINTS.DEFENDANTS.UPDATE(id), data);
};

/** Delete a defendant */
export const deleteDefendant = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.DEFENDANTS.DELETE(id));
};

/** Merge secondary defendants into a primary defendant */
export const mergeDefendants = async (
	data: DefendantMergeRequest
): Promise<DefendantMergeResponse> => {
	return apiClient.post<DefendantMergeResponse>(
		ENDPOINTS.DEFENDANTS.MERGE,
		data
	);
};

/** Search defendants */
export const searchDefendants = async (
	params: DefendantSearchParams
): Promise<PaginatedDefendantsResponse> => {
	const cleanParams = buildQueryParams({
		search: params.search,
		ordering: params.ordering,
		limit: params.limit,
		offset: params.offset,
	});

	return apiClient.get<PaginatedDefendantsResponse>(ENDPOINTS.DEFENDANTS.LIST, {
		params: cleanParams,
	});
};
