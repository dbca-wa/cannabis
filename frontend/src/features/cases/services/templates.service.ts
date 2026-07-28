/**
 * Section C template API service functions.
 */
import { apiClient } from "@/shared/services/api";
import { TEMPLATE_ENDPOINTS } from "./templates.endpoints";
import type {
	ISectionCTemplate,
	ISectionCTemplateCreate,
	ISectionCTemplateUpdate,
} from "../types/templates.types";

/** Fetch all Section C templates. Supports ?search= query. */
export const getTemplates = async (
	search?: string
): Promise<ISectionCTemplate[]> => {
	const params = search ? `?search=${encodeURIComponent(search)}` : "";
	return apiClient.get<ISectionCTemplate[]>(
		`${TEMPLATE_ENDPOINTS.LIST}${params}`
	);
};

/** Fetch a single template by ID. */
export const getTemplate = async (pk: number): Promise<ISectionCTemplate> => {
	return apiClient.get<ISectionCTemplate>(TEMPLATE_ENDPOINTS.DETAIL(pk));
};

/** Create a new template. */
export const createTemplate = async (
	data: ISectionCTemplateCreate
): Promise<ISectionCTemplate> => {
	return apiClient.post<ISectionCTemplate>(TEMPLATE_ENDPOINTS.LIST, data);
};

/** Update an existing template. */
export const updateTemplate = async (
	pk: number,
	data: ISectionCTemplateUpdate
): Promise<ISectionCTemplate> => {
	return apiClient.patch<ISectionCTemplate>(
		TEMPLATE_ENDPOINTS.DETAIL(pk),
		data
	);
};

/** Delete a template. */
export const deleteTemplate = async (pk: number): Promise<void> => {
	return apiClient.delete(TEMPLATE_ENDPOINTS.DETAIL(pk));
};
