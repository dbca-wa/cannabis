import { useState, useEffect, useCallback, useRef } from "react";
import {
	useUserPreferences,
	useUpdateSpecificTableFilters,
} from "@/features/user/hooks/useUserPreferences";
import { logger } from "@/shared/services/logger.service";
import type {
	OfficersTableFilterPreferences,
	StationsTableFilterPreferences,
	UsersTableFilterPreferences,
	DefendantsTableFilterPreferences,
	SubmissionsTableFilterPreferences,
} from "@/shared/types/backend-api.types";

// Type mapping for different table types
type TableFilterMap = {
	officers: OfficersTableFilterPreferences;
	stations: StationsTableFilterPreferences;
	users: UsersTableFilterPreferences;
	defendants: DefendantsTableFilterPreferences;
	submissions: SubmissionsTableFilterPreferences;
};

/**
 * Custom hook for persisting table filter and sort preferences
 * Automatically saves/loads filter state to/from server preferences
 *
 * @param tableName - Name of the table (officers, stations, users)
 * @param defaultFilters - Default filter values to use if no saved preferences
 * @returns Object with current filters, setters, and persistence functions
 */
export function useTableFilterPersistence<T extends keyof TableFilterMap>(
	tableName: T,
	defaultFilters: TableFilterMap[T]
) {
	// Get user preferences from server
	const { data: userPreferences, isLoading: preferencesLoading } =
		useUserPreferences();
	const updateTableFilters = useUpdateSpecificTableFilters();

	// Local state for filters
	const [filters, setFilters] = useState<TableFilterMap[T]>(defaultFilters);
	const [isInitialized, setIsInitialized] = useState(false);

	// Debounce timer for server persistence
	const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);

	// Load saved preferences on mount
	useEffect(() => {
		if (!preferencesLoading && userPreferences && !isInitialized) {
			const savedFilters =
				userPreferences.table_filter_preferences?.[tableName];

			if (savedFilters) {
				logger.debug(`Loading saved ${tableName} table filters`, {
					savedFilters,
				});
				setFilters({ ...defaultFilters, ...savedFilters });
			} else {
				logger.debug(
					`No saved ${tableName} table filters found, using defaults`
				);
			}

			setIsInitialized(true);
		}
	}, [
		userPreferences,
		preferencesLoading,
		tableName,
		isInitialized,
		defaultFilters,
	]);

	// Function to update filters and persist to server
	const updateFilters = useCallback(
		(
			newFilters: Partial<TableFilterMap[T]>,
			persistToServer: boolean = true
		) => {
			setFilters((currentFilters) => {
				const updatedFilters = { ...currentFilters, ...newFilters };

				// Debounced persistence to server
				if (persistToServer && userPreferences) {
					// Clear existing timer
					if (persistenceTimerRef.current) {
						clearTimeout(persistenceTimerRef.current);
					}

					// Set new timer for debounced persistence
					persistenceTimerRef.current = setTimeout(() => {
						updateTableFilters.mutate({
							tableName,
							filters: updatedFilters,
						});

						logger.debug(
							`Persisting ${tableName} table filters`,
							updatedFilters
						);
					}, 300); // 300ms debounce
				}

				return updatedFilters;
			});
		},
		[tableName, updateTableFilters, userPreferences]
	);

	// Function to update a single filter
	const updateFilter = useCallback(
		<K extends keyof TableFilterMap[T]>(
			key: K,
			value: TableFilterMap[T][K],
			persistToServer: boolean = true
		) => {
			const partialUpdate = { [key]: value } as unknown as Partial<
				TableFilterMap[T]
			>;
			updateFilters(partialUpdate, persistToServer);
		},
		[updateFilters]
	);

	// Function to reset filters to defaults
	const resetFilters = useCallback(
		(persistToServer: boolean = true) => {
			setFilters(defaultFilters);

			if (persistToServer && userPreferences) {
				// Use setTimeout to avoid blocking the state update
				setTimeout(() => {
					updateTableFilters.mutate({
						tableName,
						filters: defaultFilters as Record<string, unknown>,
					});

					logger.debug(
						`Reset ${tableName} table filters to defaults`
					);
				}, 0);
			}
		},
		[defaultFilters, tableName, updateTableFilters, userPreferences]
	);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (persistenceTimerRef.current) {
				clearTimeout(persistenceTimerRef.current);
			}
		};
	}, []);

	return {
		// Current filter state
		filters,
		isLoading: preferencesLoading || !isInitialized,

		// Update functions
		updateFilters,
		updateFilter,
		resetFilters,

		// Mutation state
		isSaving: updateTableFilters.isPending,
		saveError: updateTableFilters.error,
	};
}

/**
 * Convenience hooks for specific table types
 */

export function useOfficersTableFilters(
	defaultFilters: OfficersTableFilterPreferences
) {
	return useTableFilterPersistence("officers", defaultFilters);
}

export function useStationsTableFilters(
	defaultFilters: StationsTableFilterPreferences
) {
	return useTableFilterPersistence("stations", defaultFilters);
}

export function useUsersTableFilters(
	defaultFilters: UsersTableFilterPreferences
) {
	return useTableFilterPersistence("users", defaultFilters);
}

export function useDefendantsTableFilters(
	defaultFilters: DefendantsTableFilterPreferences
) {
	return useTableFilterPersistence("defendants", defaultFilters);
}

export function useSubmissionsTableFilters(
	defaultFilters: SubmissionsTableFilterPreferences
) {
	return useTableFilterPersistence("submissions", defaultFilters);
}
