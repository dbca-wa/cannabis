import { useState, useEffect, useCallback } from "react";
import { storage } from "@/shared/services/storage.service";
import { logger } from "@/shared/services/logger.service";

interface UseLocalStorageOptions {
	ttl?: number;
	encrypt?: boolean;
	syncAcrossTabs?: boolean;
}

interface UseLocalStorageReturn<T> {
	value: T;
	setValue: (value: T | ((prev: T) => T)) => void;
	removeValue: () => void;
	loading: boolean;
	error: string | null;
}

/**
 * Hook that syncs state with localStorage using storage service
 * **Integrates with storage service**,
 * handles SSR, provides error states, supports cross-tab sync
 */
export function useLocalStorage<T>(
	key: string,
	defaultValue: T,
	options: UseLocalStorageOptions = {}
): UseLocalStorageReturn<T> {
	const { ttl, encrypt = false, syncAcrossTabs = true } = options;

	const [value, setValue] = useState<T>(defaultValue);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Initialise value from storage
	useEffect(() => {
		try {
			const storedValue = storage.getItem<T>(key);
			if (storedValue !== null) {
				setValue(storedValue);
			}
			setError(null);
		} catch (err: unknown) {
			const errorMessage = `Failed to load ${key} from localStorage`;
			setError(errorMessage);
			logger.error(errorMessage, { error: err });
		} finally {
			setLoading(false);
		}
	}, [key]);

	// Set value function
	const setStoredValue = useCallback(
		(newValue: T | ((prev: T) => T)) => {
			try {
				// Handle function updates
				const valueToStore =
					newValue instanceof Function ? newValue(value) : newValue;

				// Update local state
				setValue(valueToStore);

				// Update storage
				storage.setItem(key, valueToStore, { ttl, encrypt });

				setError(null);

				logger.debug("Value stored in localStorage", {
					key,
					hasValue: valueToStore !== null,
					encrypted: encrypt,
				});
			} catch (err: unknown) {
				const errorMessage = `Failed to save ${key} to localStorage`;
				setError(errorMessage);
				logger.error(errorMessage, { error: err });
			}
		},
		[key, value, ttl, encrypt]
	);

	// Remove value function
	const removeStoredValue = useCallback(() => {
		try {
			setValue(defaultValue);
			storage.removeItem(key);
			setError(null);

			logger.debug("Value removed from localStorage", { key });
		} catch (err: unknown) {
			const errorMessage = `Failed to remove ${key} from localStorage`;
			setError(errorMessage);
			logger.error(errorMessage, { error: err });
		}
	}, [key, defaultValue]);

	// Listen for storage changes across tabs
	useEffect(() => {
		if (!syncAcrossTabs) return;

		const handleStorageChange = (event: StorageEvent) => {
			if (
				event.key === storage["getStorageKey"](key) &&
				event.newValue !== null
			) {
				try {
					// Re-fetch from storage service to handle encryption/decryption
					const newValue = storage.getItem<T>(key);
					if (newValue !== null) {
						setValue(newValue);
					}
				} catch (err: unknown) {
					logger.error("Failed to sync localStorage change", {
						key,
						error: err,
					});
				}
			}
		};

		window.addEventListener("storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [key, syncAcrossTabs]);

	return {
		value,
		setValue: setStoredValue,
		removeValue: removeStoredValue,
		loading,
		error,
	};
}
