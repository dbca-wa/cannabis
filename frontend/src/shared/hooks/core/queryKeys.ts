/**
 * Enhanced cache configuration and query utilities
 *
 * This file provides:
 * - Cache optimization settings for different data types
 * - Debounce configuration for search operations
 * - Query key factories for consistent cache management
 * - Cache invalidation utilities
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Cache optimization settings with enhanced configurations
 */
export const cacheConfig = {
	// Search results - shorter TTL for fresh data
	search: {
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
		retry: 1,
	},

	// Initial data - longer TTL since it changes less frequently
	initial: {
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
		refetchOnWindowFocus: true,
		retry: 2,
	},

	// Detail data - medium TTL
	detail: {
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 15 * 60 * 1000, // 15 minutes
		refetchOnWindowFocus: true,
		retry: 2,
	},

	// External searches - shorter TTL since external data changes frequently
	external: {
		staleTime: 1 * 60 * 1000, // 1 minute
		gcTime: 3 * 60 * 1000, // 3 minutes
		refetchOnWindowFocus: false,
		retry: 1,
	},

	// Real-time data - very short TTL
	realtime: {
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: true,
		retry: 3,
	},

	// Static data - very long TTL
	static: {
		staleTime: 60 * 60 * 1000, // 1 hour
		gcTime: 24 * 60 * 60 * 1000, // 24 hours
		refetchOnWindowFocus: false,
		retry: 1,
	},
} as const;

/**
 * Debounce configuration for different search types
 */
export const debounceConfig = {
	// Standard search - balanced responsiveness and performance
	standard: 200,

	// Fast search - for simple lookups
	fast: 150,

	// Slow search - for complex or expensive operations
	slow: 300,

	// External search - longer delay for external APIs
	external: 400,

	// Real-time search - minimal delay
	realtime: 100,

	// Heavy search - for expensive operations
	heavy: 500,
} as const;

/**
 * Query key factories for consistent cache management
 */
export const queryKeyFactory = {
	// Base keys
	users: () => ["users"] as const,
	police: () => ["police"] as const,
	defendants: () => ["defendants"] as const,
	submissions: () => ["submissions"] as const,
	system: () => ["system"] as const,

	// User queries
	usersList: (params?: Record<string, unknown>) => 
		[...queryKeyFactory.users(), "list", params] as const,
	userDetail: (id: string | number) => 
		[...queryKeyFactory.users(), "detail", id] as const,
	userSearch: (query: string, params?: Record<string, unknown>) => 
		[...queryKeyFactory.users(), "search", query, params] as const,

	// Police queries
	policeStations: (params?: Record<string, unknown>) => 
		[...queryKeyFactory.police(), "stations", params] as const,
	policeOfficers: (params?: Record<string, unknown>) => 
		[...queryKeyFactory.police(), "officers", params] as const,

	// System queries
	systemSettings: () => 
		[...queryKeyFactory.system(), "settings"] as const,
	systemHealth: () => 
		[...queryKeyFactory.system(), "health"] as const,
} as const;

/**
 * Cache invalidation utilities
 */
export const cacheUtils = {
	/**
	 * Invalidate all queries for a specific base entity type
	 */
	invalidateEntity: (
		queryClient: QueryClient, 
		entityType: 'users' | 'police' | 'defendants' | 'submissions' | 'system'
	) => {
		return queryClient.invalidateQueries({
			queryKey: queryKeyFactory[entityType](),
		});
	},

	/**
	 * Invalidate specific query patterns
	 */
	invalidatePattern: (queryClient: QueryClient, pattern: readonly unknown[]) => {
		return queryClient.invalidateQueries({
			queryKey: pattern,
		});
	},

	/**
	 * Remove specific queries from cache
	 */
	removeQueries: (queryClient: QueryClient, pattern: readonly unknown[]) => {
		return queryClient.removeQueries({
			queryKey: pattern,
		});
	},

	/**
	 * Prefetch data with appropriate cache settings
	 */
	prefetch: async (
		queryClient: QueryClient,
		queryKey: readonly unknown[],
		queryFn: () => Promise<unknown>,
		cacheType: keyof typeof cacheConfig = "initial"
	) => {
		const config = cacheConfig[cacheType];
		return queryClient.prefetchQuery({
			queryKey,
			queryFn,
			staleTime: config.staleTime,
		});
	},
} as const;

/**
 * Hook utilities for common query patterns
 */
export const queryUtils = {
	/**
	 * Get cache configuration for a specific type
	 */
	getCacheConfig: (type: keyof typeof cacheConfig) => cacheConfig[type],

	/**
	 * Get debounce delay for a specific type
	 */
	getDebounceDelay: (type: keyof typeof debounceConfig) => debounceConfig[type],

	/**
	 * Create a search query key with consistent structure
	 */
	createSearchKey: (
		entity: string,
		query: string,
		params?: Record<string, unknown>
	) => [entity, "search", query, params] as const,

	/**
	 * Create a list query key with consistent structure
	 */
	createListKey: (
		entity: string,
		params?: Record<string, unknown>
	) => [entity, "list", params] as const,

	/**
	 * Create a detail query key with consistent structure
	 */
	createDetailKey: (
		entity: string,
		id: string | number
	) => [entity, "detail", id] as const,
} as const;
