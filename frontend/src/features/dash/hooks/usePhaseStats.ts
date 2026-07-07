import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/services/api/client.service";
import { dashboardKeys } from "./queryKeys";

interface PhaseCountEntry {
	cases: number;
	forms: number;
}

interface PhaseCountsResponse {
	assessment: PhaseCountEntry;
	unsigned_generation: PhaseCountEntry;
	batching: PhaseCountEntry;
	in_batch: PhaseCountEntry;
}

export const usePhaseStats = () => {
	return useQuery({
		queryKey: dashboardKeys.phaseStats(),
		queryFn: () =>
			apiClient.get<PhaseCountsResponse>("/cases/stats/phase-counts"),
		staleTime: 30_000, // 30 seconds — dashboard data refreshes frequently
	});
};
