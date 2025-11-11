import { useState, useEffect } from "react";
import { dashboardService } from "../services/dashboard.service";
import {
	type CertificateStatisticsResponse,
	type RevenueStatisticsResponse,
} from "@/shared/types/backend-api.types";
import { logger } from "@/shared/services/logger.service";

interface UseStatsReturn {
	certificateStats: CertificateStatisticsResponse | null;
	revenueStats: RevenueStatisticsResponse | null;
	isLoadingCertificates: boolean;
	isLoadingRevenue: boolean;
	certificateError: string | null;
	revenueError: string | null;
	refetchCertificates: () => Promise<void>;
	refetchRevenue: () => Promise<void>;
	refetchAll: () => Promise<void>;
}

export const useStats = (): UseStatsReturn => {
	const [certificateStats, setCertificateStats] =
		useState<CertificateStatisticsResponse | null>(null);
	const [revenueStats, setRevenueStats] =
		useState<RevenueStatisticsResponse | null>(null);
	const [isLoadingCertificates, setIsLoadingCertificates] = useState(true);
	const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);
	const [certificateError, setCertificateError] = useState<string | null>(
		null
	);
	const [revenueError, setRevenueError] = useState<string | null>(null);

	const fetchCertificateStats = async () => {
		try {
			setIsLoadingCertificates(true);
			setCertificateError(null);

			const result = await dashboardService.getCertificateStats();

			if (result.success) {
				setCertificateStats(result.data);
				logger.info("Certificate statistics loaded successfully", {
					currentCount: result.data.current_month.count,
				});
			} else {
				setCertificateError(
					result.error || "Failed to load certificate statistics"
				);
				setCertificateStats(null);
				logger.error("Failed to load certificate statistics", {
					error: result.error,
				});
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Unknown error occurred";
			setCertificateError(errorMessage);
			setCertificateStats(null);
			logger.error("Unexpected error loading certificate statistics", {
				error: errorMessage,
			});
		} finally {
			setIsLoadingCertificates(false);
		}
	};

	const fetchRevenueStats = async () => {
		try {
			setIsLoadingRevenue(true);
			setRevenueError(null);

			const result = await dashboardService.getRevenueStats();

			if (result.success) {
				setRevenueStats(result.data);
				logger.info("Revenue statistics loaded successfully", {
					currentTotal: result.data.current_month.total,
				});
			} else {
				setRevenueError(
					result.error || "Failed to load revenue statistics"
				);
				setRevenueStats(null);
				logger.error("Failed to load revenue statistics", {
					error: result.error,
				});
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Unknown error occurred";
			setRevenueError(errorMessage);
			setRevenueStats(null);
			logger.error("Unexpected error loading revenue statistics", {
				error: errorMessage,
			});
		} finally {
			setIsLoadingRevenue(false);
		}
	};

	const refetchCertificates = async () => {
		await fetchCertificateStats();
	};

	const refetchRevenue = async () => {
		await fetchRevenueStats();
	};

	const refetchAll = async () => {
		await Promise.all([fetchCertificateStats(), fetchRevenueStats()]);
	};

	useEffect(() => {
		// Fetch both statistics on mount
		fetchCertificateStats();
		fetchRevenueStats();
	}, []);

	return {
		certificateStats,
		revenueStats,
		isLoadingCertificates,
		isLoadingRevenue,
		certificateError,
		revenueError,
		refetchCertificates,
		refetchRevenue,
		refetchAll,
	};
};
