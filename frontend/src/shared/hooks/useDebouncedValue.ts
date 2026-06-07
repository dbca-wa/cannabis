import { useState, useEffect } from "react";

/**
 * Hook that debounces a value
 * Useful for search inputs where you want to wait until user stops typing
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState("");
 * const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
 *
 * // Use debouncedSearchTerm for API calls
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     fetchResults(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 */
export const useDebouncedValue = <T>(value: T, delay: number = 300): T => {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
};
