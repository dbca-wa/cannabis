import { useQuery } from "@tanstack/react-query";
import { getPendingAttention } from "../services/dashboard.service";
import { type PendingAttentionCase } from "@/shared/types/backend-api.types";
import { dashboardKeys } from "./queryKeys";

/**
 * TanStack Query hook for fetching cases requiring the current user's attention.
 * Refetches on window focus and considers data stale after 30 seconds.
 */
export const usePendingAttention = () => {
	return useQuery<PendingAttentionCase[]>({
		queryKey: dashboardKeys.pendingAttention(),
		queryFn: getPendingAttention,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});
};
