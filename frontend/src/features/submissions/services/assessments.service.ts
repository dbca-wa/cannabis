import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient } from "@/shared/services/api";
import { type ServiceResult } from "@/shared/types/backend-api.types";
import {
	type BotanicalAssessment,
	type BotanicalAssessmentRequest,
} from "@/shared/types/backend-api.types";


class AssessmentsService {
	private static readonly BASE_URL = "/submissions";

	private generateRequestId(): string {
		return `assessments_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	/**
	 * Get botanical assessment by ID
	 */
	async getAssessmentById(
		id: number
	): Promise<ServiceResult<BotanicalAssessment>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching botanical assessment by ID", {
			assessmentId: id,
			requestId,
		});

		try {
			const response = await apiClient.get<BotanicalAssessment>(
				`${AssessmentsService.BASE_URL}/assessments/${id}/`
			);



			logger.info("Botanical assessment fetched successfully", {
				assessmentId: id,
				determination: response.determination,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);



			logger.error("Failed to fetch botanical assessment", {
				assessmentId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as BotanicalAssessment,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Create botanical assessment for a drug bag
	 */
	async createAssessment(
		drugBagId: number,
		data: BotanicalAssessmentRequest
	): Promise<ServiceResult<BotanicalAssessment>> {
		const requestId = this.generateRequestId();

		logger.info("Creating botanical assessment", {
			drugBagId,
			data,
			requestId,
		});

		try {
			const response = await apiClient.post<BotanicalAssessment>(
				`${AssessmentsService.BASE_URL}/bags/${drugBagId}/assessment/`,
				data
			);



			logger.info("Botanical assessment created successfully", {
				assessmentId: response.id,
				drugBagId,
				determination: response.determination,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);



			logger.error("Failed to create botanical assessment", {
				drugBagId,
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as BotanicalAssessment,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Update existing botanical assessment
	 */
	async updateAssessment(
		id: number,
		data: BotanicalAssessmentRequest
	): Promise<ServiceResult<BotanicalAssessment>> {
		const requestId = this.generateRequestId();

		logger.info("Updating botanical assessment", {
			assessmentId: id,
			data,
			requestId,
		});

		try {
			const response = await apiClient.patch<BotanicalAssessment>(
				`${AssessmentsService.BASE_URL}/assessments/${id}/`,
				data
			);



			logger.info("Botanical assessment updated successfully", {
				assessmentId: id,
				determination: response.determination,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);



			logger.error("Failed to update botanical assessment", {
				assessmentId: id,
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as BotanicalAssessment,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Delete botanical assessment
	 */
	async deleteAssessment(id: number): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();

		logger.info("Deleting botanical assessment", {
			assessmentId: id,
			requestId,
		});

		try {
			await apiClient.delete(
				`${AssessmentsService.BASE_URL}/assessments/${id}/`
			);



			logger.info("Botanical assessment deleted successfully", {
				assessmentId: id,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);



			logger.error("Failed to delete botanical assessment", {
				assessmentId: id,
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
	 * Get determination color class for UI display
	 */
	static getDeterminationColorClass(
		determination: string,
		isDark: boolean = false
	): string {
		const colorMap: Record<string, { light: string; dark: string }> = {
			pending: { light: "text-gray-600", dark: "text-gray-400" },
			cannabis_sativa: {
				light: "text-green-600",
				dark: "text-green-400",
			},
			cannabis_indica: {
				light: "text-green-600",
				dark: "text-green-400",
			},
			cannabis_hybrid: {
				light: "text-green-600",
				dark: "text-green-400",
			},
			mixed: { light: "text-green-600", dark: "text-green-400" },
			papaver_somniferum: { light: "text-red-600", dark: "text-red-400" },
			degraded: { light: "text-yellow-600", dark: "text-yellow-400" },
			not_cannabis: { light: "text-blue-600", dark: "text-blue-400" },
			unidentifiable: { light: "text-gray-600", dark: "text-gray-400" },
			inconclusive: { light: "text-orange-600", dark: "text-orange-400" },
		};

		const colors = colorMap[determination];
		if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

		return isDark ? colors.dark : colors.light;
	}

	/**
	 * Get determination badge class for UI display
	 */
	static getDeterminationBadgeClass(determination: string): string {
		const badgeMap: Record<string, string> = {
			pending: "bg-gray-100 text-gray-800",
			cannabis_sativa: "bg-green-100 text-green-800",
			cannabis_indica: "bg-green-100 text-green-800",
			cannabis_hybrid: "bg-green-100 text-green-800",
			mixed: "bg-green-100 text-green-800",
			papaver_somniferum: "bg-red-100 text-red-800",
			degraded: "bg-yellow-100 text-yellow-800",
			not_cannabis: "bg-blue-100 text-blue-800",
			unidentifiable: "bg-gray-100 text-gray-800",
			inconclusive: "bg-orange-100 text-orange-800",
		};

		return badgeMap[determination] || "bg-gray-100 text-gray-800";
	}

	/**
	 * Check if determination indicates cannabis
	 */
	static isCannabis(determination: string): boolean {
		const cannabisTypes = [
			"cannabis_sativa",
			"cannabis_indica",
			"cannabis_hybrid",
			"mixed",
		];
		return cannabisTypes.includes(determination);
	}

	/**
	 * Check if determination indicates controlled substance
	 */
	static isControlledSubstance(determination: string): boolean {
		const controlledSubstances = [
			"cannabis_sativa",
			"cannabis_indica",
			"cannabis_hybrid",
			"mixed",
			"papaver_somniferum",
		];
		return controlledSubstances.includes(determination);
	}
}

// Export both the class and an instance
export const assessmentsService = new AssessmentsService();
export { AssessmentsService };
