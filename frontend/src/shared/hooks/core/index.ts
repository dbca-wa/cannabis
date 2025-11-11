/**
 * Core hooks - Essential utilities for async operations, debouncing, storage, and caching
 */

// Async operations
export { useAsync } from "./useAsync";
export type { UseAsyncOptions, UseAsyncReturn } from "./useAsync";

// Debouncing utilities
export { useDebounce, useDebouncedCallback } from "./useDebounce";

// Storage utilities
export { useLocalStorage } from "./useLocalStorage";
export type { UseLocalStorageOptions, UseLocalStorageReturn } from "./useLocalStorage";

// Time utilities
export { useTimeSince, default as useCalculateTimeSince } from "./useCalculateTimeSince";
export type { DateInput, UseTimeSinceOptions, UseTimeSinceReturn } from "./useCalculateTimeSince";

// Cache and query utilities
export * from "./queryKeys";