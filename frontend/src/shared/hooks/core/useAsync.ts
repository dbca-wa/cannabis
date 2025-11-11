import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";

interface UseAsyncState<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
}

export interface UseAsyncOptions {
	immediate?: boolean;
	onSuccess?: (data: unknown) => void;
	onError?: (error: string) => void;
}

export interface UseAsyncReturn<T, Args extends unknown[]> {
	data: T | null;
	loading: boolean;
	error: string | null;
	execute: (...args: Args) => Promise<T | null>;
	reset: () => void;
}

/**
 * Hook for handling async operations with loading, error, and success states
 * **error handling, cleanup, and flexibility**
 */
export function useAsync<T, Args extends unknown[] = []>(
	asyncFunction: (...args: Args) => Promise<T>,
	options: UseAsyncOptions = {}
): UseAsyncReturn<T, Args> {
	const { immediate = false, onSuccess, onError } = options;

	const [state, setState] = useState<UseAsyncState<T>>({
		data: null,
		loading: immediate,
		error: null,
	});

	// Track if component is mounted to prevent state updates after unmount
	const isMountedRef = useRef(true);

	// Track current execution to handle race conditions
	const executionIdRef = useRef(0);

	const execute = useCallback(
		async (...args: Args): Promise<T | null> => {
			const currentExecutionId = ++executionIdRef.current;

			if (!isMountedRef.current) return null;

			setState((prev) => ({ ...prev, loading: true, error: null }));

			try {
				const result = await asyncFunction(...args);

				// Only update state if this is still the latest execution and component is mounted
				if (
					currentExecutionId === executionIdRef.current &&
					isMountedRef.current
				) {
					setState({ data: result, loading: false, error: null });
					onSuccess?.(result);
					return result;
				}

				return null;
			} catch (error: unknown) {
				const errorMessage = getErrorMessage(error);

				// Only update state if this is still the latest execution and component is mounted
				if (
					currentExecutionId === executionIdRef.current &&
					isMountedRef.current
				) {
					setState((prev) => ({
						...prev,
						loading: false,
						error: errorMessage,
					}));
					onError?.(errorMessage);

					logger.error("useAsync execution failed", {
						error: errorMessage,
						executionId: currentExecutionId,
					});
				}

				return null;
			}
		},
		[asyncFunction, onSuccess, onError]
	);

	const reset = useCallback(() => {
		if (isMountedRef.current) {
			setState({ data: null, loading: false, error: null });
			executionIdRef.current++; // Cancel any pending executions
		}
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Execute immediately if requested
	useEffect(() => {
		if (immediate) {
			execute(...([] as unknown as Args));
		}
	}, [immediate, execute]);

	return {
		data: state.data,
		loading: state.loading,
		error: state.error,
		execute,
		reset,
	};
}
