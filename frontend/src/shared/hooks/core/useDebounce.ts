import { useEffect, useRef, useState } from "react";


/**
 * Hook that debounces a value
 * **Memory efficient, proper cleanup**
 */
export function useDebounce<T>(
	value: T,
	delay: number,
	_options?: {
		entityType?: string;
		trackPerformance?: boolean;
	}
): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	);
	// Removed performance tracking variables

	useEffect(() => {
		// Clear existing timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		// Set new timeout
		timeoutRef.current = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		// Cleanup function
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [value, delay]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return debouncedValue;
}

/**
 * Hook that debounces a callback function
 * Useful for search inputs, API calls, etc.
 */
export function useDebouncedCallback<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delay: number
): (...args: Args) => void {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	);
	const callbackRef = useRef(callback);

	// Update callback ref when callback changes
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return (...args: Args) => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			callbackRef.current(...args);
		}, delay);
	};
}
