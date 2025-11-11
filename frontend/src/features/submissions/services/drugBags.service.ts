import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient } from "@/shared/services/api";
import { type ServiceResult } from "@/shared/types/backend-api.types";
import {
	type DrugBag,
	type PaginatedDrugBagsResponse,
	type DrugBagCreateRequest,
	type DrugBagUpdateRequest,
} from "@/shared/types/backend-api.types";


class DrugBagsService {
	private static readonly BASE_URL = "/submissions";

	private generateRequestId(): string {
		return `drugbags_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	/**
	 * Get drug bags for a specific submission
	 */
	async getDrugBags(
		submissionId: number
	): Promise<ServiceResult<PaginatedDrugBagsResponse>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching drug bags for submission", {
			submissionId,
			requestId,
		});

		try {
			const response = await apiClient.get<PaginatedDrugBagsResponse>(
				`${DrugBagsService.BASE_URL}/${submissionId}/bags/`
			);

			// Removed performance monitoring

			logger.info("Drug bags fetched successfully", {
				submissionId,
				count: response.results?.length || 0,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Removed performance monitoring

			logger.error("Failed to fetch drug bags", {
				submissionId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as PaginatedDrugBagsResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Get drug bag by ID
	 */
	async getDrugBagById(id: number): Promise<ServiceResult<DrugBag>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching drug bag by ID", { drugBagId: id, requestId });

		try {
			const response = await apiClient.get<DrugBag>(
				`${DrugBagsService.BASE_URL}/bags/${id}/`
			);

			// Removed performance monitoring

			logger.info("Drug bag fetched successfully", {
				drugBagId: id,
				sealTagNumbers: response.seal_tag_numbers,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Removed performance monitoring

			logger.error("Failed to fetch drug bag", {
				drugBagId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as DrugBag,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Create new drug bag
	 */
	async createDrugBag(
		data: DrugBagCreateRequest
	): Promise<ServiceResult<DrugBag>> {
		const requestId = this.generateRequestId();

		logger.info("Creating new drug bag", { data, requestId });

		try {
			const response = await apiClient.post<DrugBag>(
				`${DrugBagsService.BASE_URL}/${data.submission}/bags/`,
				data
			);

			// Removed performance monitoring

			logger.info("Drug bag created successfully", {
				drugBagId: response.id,
				submissionId: data.submission,
				sealTagNumbers: response.seal_tag_numbers,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Removed performance monitoring

			logger.error("Failed to create drug bag", {
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as DrugBag,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Update existing drug bag
	 */
	async updateDrugBag(
		id: number,
		data: DrugBagUpdateRequest
	): Promise<ServiceResult<DrugBag>> {
		const requestId = this.generateRequestId();

		logger.info("Updating drug bag", { drugBagId: id, data, requestId });

		try {
			const response = await apiClient.patch<DrugBag>(
				`${DrugBagsService.BASE_URL}/bags/${id}/`,
				data
			);

			// Removed performance monitoring

			logger.info("Drug bag updated successfully", {
				drugBagId: id,
				sealTagNumbers: response.seal_tag_numbers,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Removed performance monitoring

			logger.error("Failed to update drug bag", {
				drugBagId: id,
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as DrugBag,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Delete drug bag
	 */
	async deleteDrugBag(id: number): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();

		logger.info("Deleting drug bag", { drugBagId: id, requestId });

		try {
			await apiClient.delete(`${DrugBagsService.BASE_URL}/bags/${id}/`);

			// Removed performance monitoring

			logger.info("Drug bag deleted successfully", {
				drugBagId: id,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Removed performance monitoring

			logger.error("Failed to delete drug bag", {
				drugBagId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Format drug bag display name for UI
	 */
	static formatDrugBagDisplayName(drugBag: DrugBag): string {
		return `${drugBag.seal_tag_numbers} - ${drugBag.content_type_display}`;
	}

	/**
	 * Get content type color class for UI display
	 */
	static getContentTypeColorClass(
		contentType: string,
		isDark: boolean = false
	): string {
		const colorMap: Record<string, { light: string; dark: string }> = {
			plant: { light: "text-green-600", dark: "text-green-400" },
			plant_material: { light: "text-green-600", dark: "text-green-400" },
			cutting: { light: "text-emerald-600", dark: "text-emerald-400" },
			seed: { light: "text-yellow-600", dark: "text-yellow-400" },
			seed_material: {
				light: "text-yellow-600",
				dark: "text-yellow-400",
			},
			poppy: { light: "text-red-600", dark: "text-red-400" },
			poppy_plant: { light: "text-red-600", dark: "text-red-400" },
			unknown: { light: "text-gray-600", dark: "text-gray-400" },
			unsure: { light: "text-gray-600", dark: "text-gray-400" },
		};

		const colors = colorMap[contentType];
		if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

		return isDark ? colors.dark : colors.light;
	}

	/**
	 * Get content type badge class for UI display
	 */
	static getContentTypeBadgeClass(contentType: string): string {
		const badgeMap: Record<string, string> = {
			plant: "bg-green-100 text-green-800",
			plant_material: "bg-green-100 text-green-800",
			cutting: "bg-emerald-100 text-emerald-800",
			seed: "bg-yellow-100 text-yellow-800",
			seed_material: "bg-yellow-100 text-yellow-800",
			poppy: "bg-red-100 text-red-800",
			poppy_plant: "bg-red-100 text-red-800",
			unknown: "bg-gray-100 text-gray-800",
			unsure: "bg-gray-100 text-gray-800",
		};

		return badgeMap[contentType] || "bg-gray-100 text-gray-800";
	}
}

// Export both the class and an instance
export const drugBagsService = new DrugBagsService();
export { DrugBagsService };
