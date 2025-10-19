/**
 * Data hooks - Data management, API interactions, pagination, and table utilities
 */

// Pagination utilities
export { useServerPagination } from "./useServerPagination";
export type {
	ServerPaginationParams,
	ServerPaginationResult,
	UseServerPaginationOptions,
	UseServerPaginationReturn,
} from "./useServerPagination";

// Bulk selection utilities
export { useBulkSelection } from "./useBulkSelection";
export type {
	BulkSelectionState,
	BulkSelectionActions,
	UseBulkSelectionOptions,
} from "./useBulkSelection";

// Table filter persistence
export {
	useTableFilterPersistence,
	useOfficersTableFilters,
	useStationsTableFilters,
	useUsersTableFilters,
	useDefendantsTableFilters,
	useSubmissionsTableFilters,
} from "./useTableFilterPersistence";

// Export utilities
export { useExport } from "./useExport";
// export type { UseExportOptions } from "./useExport";

// System data
export { useSystemSettings } from "./useSystemSettings";

// Consolidated table state management
// export { useTableState } from "./useTableState";
// export type {
// 	UseTableStateOptions,
// 	UseTableStateReturn,
// } from "./useTableState";
