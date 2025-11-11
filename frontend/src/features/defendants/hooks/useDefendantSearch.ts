import { DefendantsService } from "../services/defendants.service";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebounce } from "@/shared/hooks";
import { cacheConfig, debounceConfig } from "@/shared/hooks/core/queryKeys";
import type {
	PaginatedDefendantsResponse,
	DefendantTiny,
	DefendantSearchParams,
} from "@/shared/types/backend-api.types";

export interface UseDefendantSearchOptions {
	query?: string;
	ordering?: string;
	exclude?: number[];
	enabled?: boolean;
	debounceMs?: number;
	limit?: number;
	loadInitialData?: boolean;
	initialDataLimit?: number;
}

export interface DefendantSearchResult {
	data: PaginatedDefendantsResponse | undefined;
	isLoading: boolean;
	error: Error | null;
	// Enhanced loading states
	isInitialLoading: boolean;
	isSearching: boolean;
	hasInitialData: boolean;
	initialData: DefendantTiny[] | null;
	// Error handling
	initialDataError: Error | null;
	searchError: Error | null;
	retry: () => void;
	retryInitialData: () => void;
	isRetrying: boolean;
}

export const useDefendantSearch = (
	options: UseDefendantSearchOptions = {}
): DefendantSearchResult => {
	const {
		query = "",
		ordering,
		exclude: _exclude = [], // Unused for now but kept for future use
		enabled = true,
		debounceMs = debounceConfig.standard, // Use optimized debounce config
		limit = 6,
		loadInitialData = true,
		initialDataLimit = 6,
	} = options;

	const debouncedQuery = useDebounce(query, debounceMs, {
		entityType: "defendants",
		trackPerformance: true,
	});
	const isSearchQuery = debouncedQuery.length >= 1 || !!ordering;
	const isInitialDataRequest = !isSearchQuery && loadInitialData;

	// Simple query keys - direct and easy to understand
	const searchQueryKey = useMemo(
		() =>
			[
				"defendants",
				"search",
				{ query: debouncedQuery, ordering, limit },
			] as const,
		[debouncedQuery, ordering, limit]
	);

	const initialDataQueryKey = useMemo(
		() => ["defendants", "initial", { limit: initialDataLimit }] as const,
		[initialDataLimit]
	);

	// Search query (when user types or has ordering)
	const searchQuery = useQuery({
		queryKey: searchQueryKey,
		queryFn: async (): Promise<PaginatedDefendantsResponse> => {
			const searchParams: DefendantSearchParams = {
				search: debouncedQuery,
				ordering,
				limit,
			};

			return await DefendantsService.searchDefendants(searchParams);
		},
		enabled: enabled && isSearchQuery,
		...cacheConfig.search, // Use optimized cache settings
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});

	// Initial data query (when combobox opens with no search)
	const initialDataQuery = useQuery({
		queryKey: initialDataQueryKey,
		queryFn: async (): Promise<PaginatedDefendantsResponse> => {
			const searchParams: DefendantSearchParams = {
				search: "",
				ordering: "last_name", // Default ordering for initial data
				limit: initialDataLimit,
			};

			return await DefendantsService.searchDefendants(searchParams);
		},
		enabled: enabled && isInitialDataRequest,
		...cacheConfig.initial, // Use optimized cache settings for initial data
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});

	// Determine which query to use and calculate enhanced states
	const activeQuery = isSearchQuery ? searchQuery : initialDataQuery;
	const hasInitialData = !!initialDataQuery.data?.results?.length;
	const isInitialLoading =
		isInitialDataRequest && initialDataQuery.isLoading && !hasInitialData;
	const isSearching = isSearchQuery && searchQuery.isLoading;

	// Error handling functions
	const retry = () => {
		if (isSearchQuery) {
			searchQuery.refetch();
		} else {
			initialDataQuery.refetch();
		}
	};

	const retryInitialData = () => {
		initialDataQuery.refetch();
	};

	// Determine if we're retrying
	const isRetrying =
		(isSearchQuery && searchQuery.isFetching && !!searchQuery.error) ||
		(isInitialDataRequest &&
			initialDataQuery.isFetching &&
			!!initialDataQuery.error);

	return {
		data: activeQuery.data,
		isLoading: activeQuery.isLoading,
		error: activeQuery.error,
		// Enhanced loading states
		isInitialLoading,
		isSearching,
		hasInitialData,
		initialData: initialDataQuery.data?.results || null,
		// Error handling
		initialDataError: initialDataQuery.error,
		searchError: searchQuery.error,
		retry,
		retryInitialData,
		isRetrying,
	};
};
