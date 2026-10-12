/**
 * Mirrors the system ``allow_saved_searches`` flag into the search stores.
 *
 * The search stores are constructed at import time, before the flag has loaded,
 * and default to not persisting. This applies the flag once it resolves: turning
 * the gate on restores any saved state, turning it off clears it. Mounted once
 * in the authenticated layout.
 */
import { useEffect } from "react";

import { setSavedSearchPersistenceAllowed } from "@/app/stores/derived/searchPersistence";
import { useSavedSearchesAllowed } from "@/shared/hooks/data/useFeatureFlags";

export const useSavedSearchGate = (): void => {
	const allowed = useSavedSearchesAllowed();

	useEffect(() => {
		setSavedSearchPersistenceAllowed(allowed);
	}, [allowed]);
};
