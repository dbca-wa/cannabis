import { useState, useEffect } from "react";
import { dashboardService } from "../services/dashboard.service";
import { type DashboardUserSubmission } from "@/shared/types/backend-api.types";
import { logger } from "@/shared/services/logger.service";

interface UseMySubmissionsReturn {
	submissions: DashboardUserSubmission[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export const useMySubmissions = (): UseMySubmissionsReturn => {
	const [submissions, setSubmissions] = useState<DashboardUserSubmission[]>(
		[]
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchSubmissions = async () => {
		try {
			setIsLoading(true);
			setError(null);

			const result = await dashboardService.getMySubmissions();

			if (result.success) {
				setSubmissions(result.data.results);
				logger.info("My submissions loaded successfully", {
					count: result.data.results.length,
				});
			} else {
				setError(result.error || "Failed to load submissions");
				setSubmissions([]);
				logger.error("Failed to load my submissions", {
					error: result.error,
				});
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Unknown error occurred";
			setError(errorMessage);
			setSubmissions([]);
			logger.error("Unexpected error loading my submissions", {
				error: errorMessage,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const refetch = async () => {
		await fetchSubmissions();
	};

	useEffect(() => {
		fetchSubmissions();
	}, []);

	return {
		submissions,
		isLoading,
		error,
		refetch,
	};
};
