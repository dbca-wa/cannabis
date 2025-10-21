import { usersService } from "../services/users.service";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebounce } from "@/shared/hooks/core";
import { cacheConfig, debounceConfig } from "@/shared/hooks/core";
import {
	type PaginatedUsersResponse,
	type Role,
	type IUser,
} from "../types/users.types";

export interface UseUserSearchOptions {
	query?: string;
	role?: Role | "all";
	exclude?: number[];
	enabled?: boolean;
	debounceMs?: number;
	limit?: number;
	loadInitialData?: boolean;
	initialDataLimit?: number;
}

export interface UserSearchResult {
	data: PaginatedUsersResponse | undefined;
	isLoading: boolean;
	error: Error | null;
	// Enhanced loading states
	isInitialLoading: boolean;
	isSearching: boolean;
	hasInitialData: boolean;
	initialData: IUser[] | null;
	// Error handling
	initialDataError: Error | null;
	searchError: Error | null;
	retry: () => void;
	retryInitialData: () => void;
	isRetrying: boolean;
}

export const useUserSearch = (
	options: UseUserSearchOptions = {}
): UserSearchResult => {
	const {
		query = "",
		role,
		exclude = [],
		enabled = true,
		debounceMs = debounceConfig.standard, // Use optimized debounce config
		limit = 6,
		loadInitialData = true,
		initialDataLimit = 6,
	} = options;

	const debouncedQuery = useDebounce(query, debounceMs, {
		entityType: "users",
		trackPerformance: true,
	});
	const isSearchQuery = debouncedQuery.length >= 1 || !!role;
	const isInitialDataRequest = !isSearchQuery && loadInitialData;

	// Simple query keys - direct and easy to understand
	const searchQueryKey = useMemo(
		() => [
			"users",
			"search",
			{ query: debouncedQuery, role, exclude, limit },
		] as const,
		[debouncedQuery, role, exclude, limit]
	);

	const initialDataQueryKey = useMemo(
		() => ["users", "initial", { role, exclude, limit: initialDataLimit }] as const,
		[role, exclude, initialDataLimit]
	);

	// Search query (when user types or has role filter)
	const searchQuery = useQuery({
		queryKey: searchQueryKey,
		queryFn: async (): Promise<PaginatedUsersResponse> => {
			const result = await usersService.searchUsers({
				query: debouncedQuery,
				role: role !== "all" ? role : undefined,
				exclude,
				limit,
			});

			if (!result.success) {
				throw new Error(result.error || "Failed to search users");
			}

			// Apply client-side role filtering with admin always visible
			if (role && role !== "all") {
				const filteredResults = result.data.results.filter((user: IUser) => {
					// Admin users are always visible regardless of roleFilter
					if (user.is_superuser || user.is_staff) {
						return true;
					}
					// Filter by specific role
					return user.role === role;
				});

				return {
					...result.data,
					results: filteredResults,
					count: filteredResults.length,
				};
			}

			return result.data;
		},
		enabled: enabled && isSearchQuery,
		...cacheConfig.search, // Use optimized cache settings
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});

	// Initial data query (when combobox opens with no search)
	const initialDataQuery = useQuery({
		queryKey: initialDataQueryKey,
		queryFn: async (): Promise<PaginatedUsersResponse> => {
			const result = await usersService.searchUsers({
				query: "",
				role: role !== "all" ? role : undefined,
				exclude,
				limit: initialDataLimit,
			});

			if (!result.success) {
				throw new Error(result.error || "Failed to load initial users");
			}

			// Apply client-side role filtering with admin always visible
			if (role && role !== "all") {
				const filteredResults = result.data.results.filter((user: IUser) => {
					// Admin users are always visible regardless of roleFilter
					if (user.is_superuser || user.is_staff) {
						return true;
					}
					// Filter by specific role
					return user.role === role;
				});

				return {
					...result.data,
					results: filteredResults,
					count: filteredResults.length,
				};
			}

			return result.data;
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
