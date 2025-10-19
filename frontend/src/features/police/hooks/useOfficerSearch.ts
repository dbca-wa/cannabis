import { policeOfficersService } from "../services/policeOfficers.service";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebounce } from "@/shared/hooks";
import { cacheConfig, debounceConfig } from "@/shared/hooks/core/queryKeys";
import type {
	PaginatedPoliceOfficersResponse,
	PoliceOfficerTiny,
} from "@/shared/types/backend-api.types";

export interface UseOfficerSearchOptions {
	query?: string;
	enabled?: boolean;
	debounceMs?: number;
	limit?: number;
	loadInitialData?: boolean;
	initialDataLimit?: number;
}

export interface OfficerSearchResult {
	data: PaginatedPoliceOfficersResponse | undefined;
	isLoading: boolean;
	error: Error | null;
	// Enhanced loading states
	isInitialLoading: boolean;
	isSearching: boolean;
	hasInitialData: boolean;
	initialData: PoliceOfficerTiny[] | null;
	// Error handling
	initialDataError: Error | null;
	searchError: Error | null;
	retry: () => void;
	retryInitialData: () => void;
	isRetrying: boolean;
}

export const useOfficerSearch = (
	options: UseOfficerSearchOptions = {}
): OfficerSearchResult => {
	const {
		query = "",
		enabled = true,
		debounceMs = debounceConfig.standard, // Use optimized debounce config
		limit = 6,
		loadInitialData = true,
		initialDataLimit = 6,
	} = options;

	const debouncedQuery = useDebounce(query, debounceMs, {
		entityType: "police-officers",
		trackPerformance: true,
	});
	const isSearchQuery = debouncedQuery.length >= 1;
	const isInitialDataRequest = !isSearchQuery && loadInitialData;

	// Simple query keys - direct and easy to understand
	const searchQueryKey = useMemo(
		() =>
			[
				"police-officers",
				"search",
				{ query: debouncedQuery, limit },
			] as const,
		[debouncedQuery, limit]
	);

	const initialDataQueryKey = useMemo(
		() =>
			[
				"police-officers",
				"initial",
				{ limit: initialDataLimit },
			] as const,
		[initialDataLimit]
	);

	// Search query (when user types)
	const searchQuery = useQuery({
		queryKey: searchQueryKey,
		queryFn: async (): Promise<PaginatedPoliceOfficersResponse> => {
			const result = await policeOfficersService.getOfficers({
				search: debouncedQuery,
				limit,
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
		queryFn: async (): Promise<PaginatedPoliceOfficersResponse> => {
			const result = await policeOfficersService.getOfficers({
				limit: initialDataLimit,
				// No search parameter to get recent officers
				// Could add ordering by created_at desc for "recent" officers
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
