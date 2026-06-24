import { useQuery } from "@tanstack/react-query";
import {
	getMonthlyThroughput,
	type MonthlyThroughputEntry,
} from "../services/dashboard.service";
import { dashboardKeys } from "./queryKeys";

export const useMonthlyThroughput = () => {
	return useQuery<MonthlyThroughputEntry[]>({
		queryKey: [...dashboardKeys.all, "throughput"],
		staleTime: 5 * 60_000,
		queryFn: getMonthlyThroughput,
	});
};
