import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Defendant,
	DefendantTiny,
	DefendantCreateRequest,
	DefendantUpdateRequest,
	PaginatedDefendantsResponse,
	DefendantSearchParams,
} from "@/shared/types/backend-api.types";

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
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());

		const url = `${ENDPOINTS.DEFENDANTS.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedDefendantsResponse>(
				url
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
		const searchParams = new URLSearchParams();

		if (params.search) searchParams.append("search", params.search);
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.offset)
			searchParams.append("offset", params.offset.toString());

		const url = `${ENDPOINTS.DEFENDANTS.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedDefendantsResponse>(
				url
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
		defendant: DefendantTiny | Defendant,
		isDark: boolean = false
	): string {
		const count = defendant.cases_count;

		if (count === 0) {
			return isDark ? "text-gray-400" : "text-gray-600";
		} else if (count <= 2) {
			return isDark ? "text-blue-400" : "text-blue-600";
		} else if (count <= 5) {
			return isDark ? "text-yellow-400" : "text-yellow-600";
		} else {
			return isDark ? "text-red-400" : "text-red-600";
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
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("format", format);

		// Add filtering parameters (but not pagination)
		if (params.search) searchParams.append("search", params.search);
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.DEFENDANTS.EXPORT}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			// Debug logging
			console.log("Export request:", { url, format, params });

			// Use apiClient.getBlob for proper authentication and base URL handling
			const blob = await apiClient.getBlob(url);

			// Debug logging
			console.log("Export response:", {
				blob,
				size: blob.size,
				type: blob.type,
			});

			return blob;
		} catch (error) {
			// Debug logging
			console.error("Export error:", error);

			throw error;
		}
	}
}

// Export both class and instance for different usage patterns
export const defendantsService = new DefendantsService();