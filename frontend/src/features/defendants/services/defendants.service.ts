import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Defendant,
	DefendantTiny,
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

export class DefendantsService {
	/**
	 * Get paginated list of defendants
	 */
	static async getDefendants(
		params: DefendantsQueryParams = {}
	): Promise<PaginatedDefendantsResponse> {
		const cleanParams = buildQueryParams({
			page: params.page,
			search: params.search,
			ordering: params.ordering,
			limit: params.limit,
		});

		try {
			const result = await apiClient.get<PaginatedDefendantsResponse>(
				ENDPOINTS.DEFENDANTS.LIST,
				{ params: cleanParams }
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get a single defendant by ID
	 */
	static async getDefendantById(id: number): Promise<Defendant> {
		try {
			const result = await apiClient.get<Defendant>(
				ENDPOINTS.DEFENDANTS.DETAIL(id)
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Create a new defendant
	 */
	static async createDefendant(
		data: DefendantCreateRequest
	): Promise<Defendant> {
		try {
			const result = await apiClient.post<Defendant>(
				ENDPOINTS.DEFENDANTS.CREATE,
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Update an existing defendant
	 */
	static async updateDefendant(
		id: number,
		data: DefendantUpdateRequest
	): Promise<Defendant> {
		try {
			const result = await apiClient.put<Defendant>(
				ENDPOINTS.DEFENDANTS.UPDATE(id),
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Delete a defendant
	 */
	static async deleteDefendant(id: number): Promise<void> {
		try {
			await apiClient.delete(ENDPOINTS.DEFENDANTS.DELETE(id));
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Search defendants with debounced functionality
	 */
	static async searchDefendants(
		params: DefendantSearchParams
	): Promise<PaginatedDefendantsResponse> {
		const cleanParams = buildQueryParams({
			search: params.search,
			ordering: params.ordering,
			limit: params.limit,
			offset: params.offset,
		});

		try {
			const result = await apiClient.get<PaginatedDefendantsResponse>(
				ENDPOINTS.DEFENDANTS.LIST,
				{ params: cleanParams }
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Format defendant display name for UI components
	 */
	static formatDefendantDisplayName(
		defendant: DefendantTiny | Defendant
	): string {
		return defendant.full_name;
	}

	/**
	 * Get defendant cases badge text for UI components
	 */
	static getDefendantCasesBadge(
		defendant: DefendantTiny | Defendant
	): string {
		const count = defendant.cases_count;
		if (count === 0) return "No Cases";
		if (count === 1) return "1 Case";
		return `${count} Cases`;
	}

	/**
	 * Get defendant cases badge color class for UI components
	 */
	static getDefendantCasesBadgeColorClass(
		defendant: DefendantTiny | Defendant
	): string {
		const count = defendant.cases_count;

		if (count === 0) {
			return "text-gray-600";
		} else if (count <= 2) {
			return "text-blue-600";
		} else if (count <= 5) {
			return "text-yellow-600";
		} else {
			return "text-red-600";
		}
	}

	/**
	 * Get defendant initials for avatar display
	 */
	static getDefendantInitials(defendant: DefendantTiny | Defendant): string {
		const firstName = defendant.first_name?.trim();
		const lastName = defendant.last_name?.trim();

		if (firstName && lastName) {
			return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
		} else if (lastName) {
			return lastName.charAt(0).toUpperCase();
		} else if (firstName) {
			return firstName.charAt(0).toUpperCase();
		}

		return "D"; // Default for defendant
	}

	/**
	 * Check if defendant can be deleted (no associated cases)
	 */
	static canDeleteDefendant(defendant: DefendantTiny | Defendant): boolean {
		return defendant.cases_count === 0;
	}

	/**
	 * Get deletion warning message for defendants with cases
	 */
	static getDeletionWarningMessage(
		defendant: DefendantTiny | Defendant
	): string {
		const count = defendant.cases_count;
		if (count === 0) return "";

		return `Cannot delete defendant ${defendant.full_name}. They are associated with ${count} case(s). Please remove them from all cases before deletion.`;
	}

	/**
	 * Export all defendants data (bypasses pagination)
	 */
	static async exportDefendants(
		format: "csv" | "json" = "csv",
		params: Omit<DefendantsQueryParams, "page" | "limit"> = {}
	): Promise<Blob> {
		const cleanParams = buildQueryParams({
			format: format,
			search: params.search,
			ordering: params.ordering,
		});

		try {
			// Use apiClient.getBlob for proper authentication and base URL handling
			const blob = await apiClient.getBlob(ENDPOINTS.DEFENDANTS.EXPORT, {
				params: cleanParams,
			});

			return blob;
		} catch (error) {
			throw error;
		}
	}
}

// Export both class and instance for different usage patterns
export const defendantsService = new DefendantsService();
