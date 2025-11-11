import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient } from "@/shared/services/api";
import {
	type ServiceResult,
	type DashboardUserSubmissionsResponse,
	type CertificateStatisticsResponse,
	type RevenueStatisticsResponse,
} from "@/shared/types/backend-api.types";

class DashboardService {
	private static readonly BASE_URL = "/submissions";

	private generateRequestId(): string {
		return `dashboard_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	/**
	 * Get submissions the current user is involved in
	 */
	async getMySubmissions(): Promise<
		ServiceResult<DashboardUserSubmissionsResponse>
	> {
		const requestId = this.generateRequestId();

		logger.info("Fetching user submissions for dashboard", { requestId });

		try {
			const response =
				await apiClient.get<DashboardUserSubmissionsResponse>(
					`${DashboardService.BASE_URL}/my/`
				);

			logger.info("User submissions fetched successfully", {
				count: response.results?.length || 0,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch user submissions", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: { results: [], count: 0 },
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Get certificate statistics with comparisons
	 */
	async getCertificateStats(): Promise<
		ServiceResult<CertificateStatisticsResponse>
	> {
		const requestId = this.generateRequestId();

		logger.info("Fetching certificate statistics", { requestId });

		try {
			const response = await apiClient.get<CertificateStatisticsResponse>(
				`${DashboardService.BASE_URL}/stats/certificates/`
			);

			logger.info("Certificate statistics fetched successfully", {
				currentCount: response.current_month.count,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch certificate statistics", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {
					current_month: { count: 0, month: "", year: 0 },
					previous_month: null,
					previous_year_same_month: null,
				},
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Get revenue statistics with comparisons
	 */
	async getRevenueStats(): Promise<ServiceResult<RevenueStatisticsResponse>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching revenue statistics", { requestId });

		try {
			const response = await apiClient.get<RevenueStatisticsResponse>(
				`${DashboardService.BASE_URL}/stats/revenue/`
			);

			logger.info("Revenue statistics fetched successfully", {
				currentTotal: response.current_month.total,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch revenue statistics", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {
					current_month: { total: 0, month: "", year: 0 },
					previous_month: null,
					previous_year_same_month: null,
				},
				success: false,
				error: normalizedError.message,
			};
		}
	}
}

// Export both the class and an instance
export const dashboardService = new DashboardService();
export { DashboardService };
