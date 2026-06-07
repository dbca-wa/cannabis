import { useQuery } from "@tanstack/react-query";
import { getRevenueStats } from "../services/dashboard.service";
import { type RevenueStatisticsResponse } from "@/shared/types/backend-api.types";
import { dashboardKeys } from "./queryKeys";

export const useRevenueStats = () => {
	return useQuery<RevenueStatisticsResponse>({
		queryKey: dashboardKeys.statsRevenue(),
		staleTime: 5 * 60_000,
		queryFn: getRevenueStats,
	});
};
