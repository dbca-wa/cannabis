import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type {
	DashboardUserCasesResponse,
	CertificateStatisticsResponse,
	RevenueStatisticsResponse,
	PendingAttentionCase,
} from "@/shared/types/backend-api.types";

/**
 * Get cases the current user is involved in for the dashboard.
 */
export const getMySubmissions =
	async (): Promise<DashboardUserCasesResponse> => {
		return apiClient.get<DashboardUserCasesResponse>(
			ENDPOINTS.DASHBOARD.MY_SUBMISSIONS
		);
	};

/**
 * Get certificate statistics with comparisons.
 */
export const getCertificateStats =
	async (): Promise<CertificateStatisticsResponse> => {
		return apiClient.get<CertificateStatisticsResponse>(
			ENDPOINTS.DASHBOARD.STATS_CERTIFICATES
		);
	};

/**
 * Get revenue statistics with comparisons.
 */
export const getRevenueStats = async (): Promise<RevenueStatisticsResponse> => {
	return apiClient.get<RevenueStatisticsResponse>(
		ENDPOINTS.DASHBOARD.STATS_REVENUE
	);
};

/**
 * Get cases requiring the current user's attention based on their role.
 */
export const getPendingAttention = async (): Promise<
	PendingAttentionCase[]
> => {
	return apiClient.get<PendingAttentionCase[]>(
		ENDPOINTS.DASHBOARD.PENDING_ATTENTION
	);
};

export interface MonthlyThroughputEntry {
	month: string;
	cases: number | null;
	certs: number | null;
	bags: number | null;
	revenue: number | null;
}

/**
 * Get monthly throughput data for the current financial year.
 */
export const getMonthlyThroughput = async (): Promise<
	MonthlyThroughputEntry[]
> => {
	return apiClient.get<MonthlyThroughputEntry[]>(
		ENDPOINTS.DASHBOARD.STATS_THROUGHPUT
	);
};
