import { externalUsersService } from "../services/externalUsers.service";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebounce, cacheConfig, debounceConfig } from "@/shared/hooks/core";
import type { ExternalUserSearchResponse } from "@/shared/types/backend-api.types";

export interface UseExternalUserSearchOptions {
	query?: string;
	enabled?: boolean;
	debounceMs?: number;
}

export const useExternalUserSearch = (
	options: UseExternalUserSearchOptions = {}
) => {
	const {
		query = "",
		enabled = true,
		debounceMs = debounceConfig.external, // Use longer debounce for external APIs
	} = options;

	const debouncedQuery = useDebounce(query, debounceMs, {
		entityType: "external-users",
		trackPerformance: true,
	});

	const queryKey = useMemo(
		() => ["external-users", "search", { query: debouncedQuery }] as const,
		[debouncedQuery]
	);

	const shouldFetch = enabled && debouncedQuery.length >= 2;

	const queryResult = useQuery({
		queryKey,
		queryFn: async (): Promise<ExternalUserSearchResponse> => {
			const result = await externalUsersService.searchExternalUsers({
				search: debouncedQuery,
			});
			return result;
		},
		enabled: shouldFetch as boolean,
		...cacheConfig.external, // Use optimized cache settings for external data
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});

	return {
		...queryResult,
		retry: () => queryResult.refetch(),
		isRetrying: queryResult.isFetching && !!queryResult.error,
	};
};
