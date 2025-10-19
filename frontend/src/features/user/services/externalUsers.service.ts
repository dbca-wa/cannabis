import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type { ExternalUserSearchResponse } from "@/shared/types/backend-api.types";

export interface ExternalUserSearchParams {
	search?: string;
}

/**
 * External Users Service
 * Handles searching for users from external IT Assets API for invitations
 */
export const externalUsersService = {
	/**
	 * Search external users by query
	 */
	async searchExternalUsers(
		params: ExternalUserSearchParams = {}
	): Promise<ExternalUserSearchResponse> {
		const searchParams = new URLSearchParams();

		if (params.search && params.search.trim()) {
			searchParams.append("search", params.search.trim());
		}

		const queryString = searchParams.toString();
		const url = queryString
			? `${ENDPOINTS.USERS.EXTERNAL_SEARCH}?${queryString}`
			: ENDPOINTS.USERS.EXTERNAL_SEARCH;

		return apiClient.get<ExternalUserSearchResponse>(url);
	},
};
