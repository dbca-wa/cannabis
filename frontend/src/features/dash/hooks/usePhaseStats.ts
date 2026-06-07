import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/services/api/client.service";
import { dashboardKeys } from "./queryKeys";

interface PhaseCountsResponse {
	assessment: number;
	data_entry: number;
	unsigned_generation: number;
	botanist_signoff: number;
	invoicing: number;
	send_emails: number;
}

export const usePhaseStats = () => {
	return useQuery({
		queryKey: dashboardKeys.phaseStats(),
		queryFn: () =>
			apiClient.get<PhaseCountsResponse>("/cases/stats/phase-counts"),
		staleTime: 30_000, // 30 seconds — dashboard data refreshes frequently
	});
};
