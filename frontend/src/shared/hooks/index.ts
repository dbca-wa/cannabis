/**
 * Shared Hooks - Organized exports for all shared hooks
 *
 * Hooks are organized into logical categories:
 * - Core: Essential utilities (async, debounce, storage, time, caching)
 * - UI: User interface related (responsive, theme, keyboard, navigation)
 * - Data: Data management (pagination, selection, filters, export, API)
 */

// ===== ORGANIZED CATEGORY EXPORTS =====

// Core hooks - Essential utilities
export * from "./core";

// UI hooks - User interface related
export * from "./ui";

// Data hooks - Data management and API
export * from "./data";

// ===== BACKWARD COMPATIBILITY EXPORTS =====
// These maintain existing import paths for components that haven't been updated yet

// Core hooks (backward compatibility)
export { useAsync } from "./core/useAsync";
export { useDebounce, useDebouncedCallback } from "./core/useDebounce";
export { useLocalStorage } from "./core/useLocalStorage";
export {
	useTimeSince,
	default as useCalculateTimeSince,
} from "./core/useCalculateTimeSince";
export * from "./core/queryKeys";

// UI hooks (backward compatibility)
export * from "./ui/useResponsive";
export { useTheme } from "./ui/useTheme";
export {
	useKeyboardShortcuts,
	commonShortcuts,
} from "./ui/useKeyboardShortcuts";
export { useSidebarItem } from "./ui/useSidebarItem";

// Data hooks (backward compatibility)
export { useServerPagination } from "./data/useServerPagination";
export { useBulkSelection } from "./data/useBulkSelection";
export { useTableFilterPersistence } from "./data/useTableFilterPersistence";
export { useExport } from "./data/useExport";
export { useSystemSettings } from "./data/useSystemSettings";
// export { useTableState } from "./data/useTableState";

// App-specific hooks (remain in root for now)
export { useAppInitialisation } from "./useAppInitialisation";
