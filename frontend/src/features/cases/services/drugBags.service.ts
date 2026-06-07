import { apiClient } from "@/shared/services/api";
import {
	type DrugBag,
	type PaginatedDrugBagsResponse,
	type DrugBagCreateRequest,
	type DrugBagUpdateRequest,
} from "@/shared/types/backend-api.types";
import { ENDPOINTS } from "@/shared/services/api/endpoints";

/**
 * Get drug bags for a specific case.
 */
export const getDrugBags = async (
	submissionId: number
): Promise<PaginatedDrugBagsResponse> => {
	return apiClient.get<PaginatedDrugBagsResponse>(
		ENDPOINTS.CASES.BAGS.LIST(submissionId)
	);
};

/**
 * Get drug bag by ID.
 */
export const getDrugBagById = async (id: number): Promise<DrugBag> => {
	return apiClient.get<DrugBag>(ENDPOINTS.CASES.BAGS.DETAIL(id));
};

/**
 * Create a new drug bag.
 */
export const createDrugBag = async (
	data: DrugBagCreateRequest
): Promise<DrugBag> => {
	return apiClient.post<DrugBag>(ENDPOINTS.CASES.BAGS.CREATE(data.case), data);
};

/**
 * Update an existing drug bag.
 */
export const updateDrugBag = async (
	id: number,
	data: DrugBagUpdateRequest
): Promise<DrugBag> => {
	return apiClient.patch<DrugBag>(ENDPOINTS.CASES.BAGS.UPDATE(id), data);
};

/**
 * Delete a drug bag.
 */
export const deleteDrugBag = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.CASES.BAGS.DELETE(id));
};
