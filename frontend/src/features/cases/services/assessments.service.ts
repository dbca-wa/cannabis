import { apiClient } from "@/shared/services/api";
import {
	type BotanicalAssessment,
	type BotanicalAssessmentRequest,
} from "@/shared/types/backend-api.types";
import { ENDPOINTS } from "@/shared/services/api/endpoints";

/**
 * Get botanical assessment by ID.
 */
export const getAssessmentById = async (
	id: number
): Promise<BotanicalAssessment> => {
	return apiClient.get<BotanicalAssessment>(
		ENDPOINTS.CASES.ASSESSMENTS.DETAIL(id)
	);
};

/**
 * Create botanical assessment for a drug bag.
 */
export const createAssessment = async (
	drugBagId: number,
	data: BotanicalAssessmentRequest
): Promise<BotanicalAssessment> => {
	return apiClient.post<BotanicalAssessment>(
		ENDPOINTS.CASES.ASSESSMENTS.CREATE(drugBagId),
		data
	);
};

/**
 * Update an existing botanical assessment.
 */
export const updateAssessment = async (
	id: number,
	data: BotanicalAssessmentRequest
): Promise<BotanicalAssessment> => {
	return apiClient.patch<BotanicalAssessment>(
		ENDPOINTS.CASES.ASSESSMENTS.UPDATE(id),
		data
	);
};

/**
 * Delete a botanical assessment.
 */
export const deleteAssessment = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.CASES.ASSESSMENTS.DELETE(id));
};
