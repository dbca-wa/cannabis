/**
 * Clears a list page's search when saved searches are off.
 *
 * The search stores are in-memory MobX singletons, so their state survives SPA
 * navigation even when persistence to localStorage is disabled. Without this, a
 * search typed on a list page lingered after navigating away and back (only a
 * full page reload cleared it). When saved searches are not allowed, this resets
 * the store as the filters component unmounts, so returning to the list — e.g.
 * after creating a record — always starts fresh.
 *
 * When saved searches are allowed, this is a no-op: the store keeps its state so
 * the remembered search works as intended.
 */
import { useEffect, useRef } from "react";

import { useSavedSearchesAllowed } from "@/shared/hooks/data/useFeatureFlags";

interface ClearableSearchStore {
	clearSearchAndFilters: () => void;
}

export const useEphemeralSearch = (store: ClearableSearchStore): void => {
	const savedSearchesAllowed = useSavedSearchesAllowed();

	// Read the latest flag at unmount via a ref, so toggling the setting while on
	// the list does not trigger a spurious clear — only leaving the page does.
	const allowedRef = useRef(savedSearchesAllowed);
	useEffect(() => {
		allowedRef.current = savedSearchesAllowed;
	}, [savedSearchesAllowed]);

	useEffect(() => {
		return () => {
			if (!allowedRef.current) {
				store.clearSearchAndFilters();
			}
		};
	}, [store]);
};
