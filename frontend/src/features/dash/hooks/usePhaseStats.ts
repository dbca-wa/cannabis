import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/services/api/client.service";
import { dashboardKeys } from "./queryKeys";

interface PhaseCountsResponse {
	assessment: number;
	unsigned_generation: number;
	batching: number;
	in_batch: number;
}

export const usePhaseStats = () => {
	return useQuery({
		queryKey: dashboardKeys.phaseStats(),
		queryFn: () =>
			apiClient.get<PhaseCountsResponse>("/cases/stats/phase-counts"),
		staleTime: 30_000, // 30 seconds — dashboard data refreshes frequently
	});
};
