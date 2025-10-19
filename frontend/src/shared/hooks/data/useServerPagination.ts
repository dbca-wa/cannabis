import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/app/providers/store.provider";
import { logger } from "@/shared/services/logger.service";

export interface ServerPaginationParams {
	page?: number;
	limit?: number;
	search?: string;
	ordering?: string;
	[key: string]: unknown;
}

export interface ServerPaginationResult<T> {
	results: T[];
	count: number;
	next: string | null;
	previous: string | null;
}

export interface UseServerPaginationOptions {
	initialPage?: number;
	defaultPageSize?: number;
	enableGlobalPageSize?: boolean;
}

export interface UseServerPaginationReturn {
	// Current state
	currentPage: number;
	pageSize: number;
	totalPages: number;
	totalItems: number;

	// Pagination controls
	setPage: (page: number) => void;
	setPageSize: (size: number) => void;
	nextPage: () => void;
	previousPage: () => void;
	firstPage: () => void;
	lastPage: () => void;

	// Query parameters for API calls
	getQueryParams: (
		additionalParams?: Record<string, unknown>
	) => ServerPaginationParams;

	// Computed values
	canGoPrevious: boolean;
	canGoNext: boolean;
	itemsShown: (resultCount: number) => number;

	// Internal helper for updating total items
	updateTotalItems: (count: number) => void;
}

/**
 * Unified server-side pagination hook that integrates with global user preferences
 * Provides consistent pagination behavior across all tables
 */
export function useServerPagination(
	options: UseServerPaginationOptions = {}
): UseServerPaginationReturn {
	const {
		initialPage = 1,
		defaultPageSize,
		enableGlobalPageSize = true,
	} = options;

	const uiStore = useUIStore();

	// Use global page size preference or fallback to default
	const globalPageSize = enableGlobalPageSize
		? uiStore.itemsPerPage
		: defaultPageSize || 25;

	// Local pagination state
	const [currentPage, setCurrentPage] = useState(initialPage);
	const [pageSize, setPageSizeState] = useState(globalPageSize);
	const [totalItems, setTotalItems] = useState(0);

	// Sync with global page size changes
	useEffect(() => {
		if (enableGlobalPageSize) {
			setPageSizeState(uiStore.itemsPerPage);
			// Reset to first page when page size changes
			setCurrentPage(1);
		}
	}, [uiStore.itemsPerPage, enableGlobalPageSize]);

	// Calculate derived values
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const canGoPrevious = currentPage > 1;
	const canGoNext = currentPage < totalPages;

	// Page navigation functions
	const setPage = useCallback(
		(page: number) => {
			const clampedPage = Math.max(1, Math.min(page, totalPages));
			setCurrentPage(clampedPage);

			logger.debug("Page changed", {
				newPage: clampedPage,
				totalPages,
				pageSize,
			});
		},
		[totalPages, pageSize]
	);

	const setPageSize = useCallback(
		async (size: number) => {
			setPageSizeState(size);
			setCurrentPage(1); // Reset to first page

			// Update global preference if enabled
			if (enableGlobalPageSize) {
				await uiStore.setItemsPerPage(size as 10 | 25 | 50 | 100);
			}

			logger.debug("Page size changed", {
				newPageSize: size,
				resetToPage: 1,
			});
		},
		[enableGlobalPageSize, uiStore]
	);

	const nextPage = useCallback(() => {
		if (canGoNext) {
			setPage(currentPage + 1);
		}
	}, [canGoNext, currentPage, setPage]);

	const previousPage = useCallback(() => {
		if (canGoPrevious) {
			setPage(currentPage - 1);
		}
	}, [canGoPrevious, currentPage, setPage]);

	const firstPage = useCallback(() => {
		setPage(1);
	}, [setPage]);

	const lastPage = useCallback(() => {
		setPage(totalPages);
	}, [setPage, totalPages]);

	// Generate query parameters for API calls
	const getQueryParams = useCallback(
		(
			additionalParams: Record<string, unknown> = {}
		): ServerPaginationParams => {
			return {
				page: currentPage,
				limit: pageSize,
				...additionalParams,
			};
		},
		[currentPage, pageSize]
	);

	// Calculate items shown for current page
	const itemsShown = useCallback(
		(resultCount: number) => {
			return Math.min(resultCount, pageSize);
		},
		[pageSize]
	);

	// Update total items when data changes (should be called by consuming components)
	const updateTotalItems = useCallback((count: number) => {
		setTotalItems(count);
	}, []);

	return {
		// Current state
		currentPage,
		pageSize,
		totalPages,
		totalItems,

		// Pagination controls
		setPage,
		setPageSize,
		nextPage,
		previousPage,
		firstPage,
		lastPage,

		// Query parameters
		getQueryParams,

		// Computed values
		canGoPrevious,
		canGoNext,
		itemsShown,

		// Internal helper (not exported in interface but available)
		updateTotalItems: updateTotalItems as any,
	};
}
