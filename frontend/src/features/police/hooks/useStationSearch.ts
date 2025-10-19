import { policeStationsService } from "../services/policeStations.service";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebounce, cacheConfig, debounceConfig } from "@/shared/hooks/core";
import type {
	PaginatedResponse,
	PoliceStation,
} from "@/shared/types/backend-api.types";

export interface UseStationSearchOptions {
	query?: string;
	enabled?: boolean;
	debounceMs?: number;
	limit?: number;
	loadInitialData?: boolean;
	initialDataLimit?: number;
}

export interface StationSearchResult {
	data: PaginatedResponse<PoliceStation> | undefined;
	isLoading: boolean;
	error: Error | null;
	// Enhanced loading states
	isInitialLoading: boolean;
	isSearching: boolean;
	hasInitialData: boolean;
	initialData: PoliceStation[] | null;
	// Error handling
	initialDataError: Error | null;
	searchError: Error | null;
	retry: () => void;
	retryInitialData: () => void;
	isRetrying: boolean;
}

export const useStationSearch = (
	options: UseStationSearchOptions = {}
): StationSearchResult => {
	const {
		query = "",
		enabled = true,
		debounceMs = debounceConfig.standard, // Use optimized debounce config
		limit = 6,
		loadInitialData = true,
		initialDataLimit = 6,
	} = options;

	const debouncedQuery = useDebounce(query, debounceMs, {
		entityType: "police-stations",
		trackPerformance: true,
	});
	const isSearchQuery = debouncedQuery.length >= 1;
	const isInitialDataRequest = !isSearchQuery && loadInitialData;

	// Simple query keys - direct and easy to understand
	const searchQueryKey = useMemo(
		() => [
			"police-stations",
			"search",
			{ query: debouncedQuery, limit },
		] as const,
		[debouncedQuery, limit]
	);

	const initialDataQueryKey = useMemo(
		() => ["police-stations", "initial", { limit: initialDataLimit }] as const,
		[initialDataLimit]
	);

	// Search query (when user types)
	const searchQuery = useQuery({
		queryKey: searchQueryKey,
		queryFn: async (): Promise<PaginatedResponse<PoliceStation>> => {
			const result = await policeStationsService.getStations({
				search: debouncedQuery,
				page: 1,
			});
			return result;
		},
		enabled: enabled && isSearchQuery,
		...cacheConfig.search, // Use optimized cache settings
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});

	// Initial data query (when combobox opens with no search)
	const initialDataQuery = useQuery({
		queryKey: initialDataQueryKey,
		queryFn: async (): Promise<PaginatedResponse<PoliceStation>> => {
			const result = await policeStationsService.getStations({
				page: 1,
				// No search parameter to get all stations
			});
			return result;
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
