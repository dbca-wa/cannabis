import { useQuery } from "@tanstack/react-query";
import { getMySubmissions } from "../services/dashboard.service";
import { type DashboardUserCase } from "@/shared/types/backend-api.types";
import { dashboardKeys } from "./queryKeys";

/**
 * Fetches cases the current user is involved in for the dashboard.
 */
export const useMySubmissions = () => {
	return useQuery<DashboardUserCase[]>({
		queryKey: dashboardKeys.mySubmissions(),
		queryFn: async () => {
			const response = await getMySubmissions();
			return response.results;
		},
		staleTime: 60_000,
	});
};
