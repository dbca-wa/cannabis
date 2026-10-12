/**
 * System-wide gate for remembering a user's search between visits.
 *
 * Saved searches are off by default for everyone: a remembered filter had been
 * hiding records a user has just created (e.g. a new case not showing on return
 * to the list). An admin can turn persistence back on from the settings page via
 * the ``allow_saved_searches`` system flag; this module mirrors that flag to the
 * search stores, which otherwise run before the flag has loaded.
 *
 * While the gate is off, the per-list "Remember search" preference has no effect:
 * stores neither restore nor write their state, so every visit starts clean.
 */

/** localStorage keys the search stores use; purged when the gate turns off. */
const SEARCH_STORAGE_KEYS = [
	"casesSearchState",
	"defendantsSearchState",
	"staffSearchState",
	"officersSearchState",
	"stationsSearchState",
];

let persistenceAllowed = false;

// Search stores register a reload callback so that, if an admin has the flag on,
// they can restore their persisted state once the flag resolves (the stores are
// constructed at import time, before the flag has loaded).
const reloaders = new Set<() => void>();

/** Whether stores may restore from or write to localStorage. */
export const isSavedSearchPersistenceAllowed = (): boolean =>
	persistenceAllowed;

/** A store registers its storage-restore callback here. */
export const registerSearchStoreReloader = (reload: () => void): void => {
	reloaders.add(reload);
};

/**
 * Apply the system flag. When turning persistence on, ask each store to restore
 * any saved state now the gate is open. When off, clear state stored from a
 * previous session so a stale saved search never resurfaces.
 */
export const setSavedSearchPersistenceAllowed = (allowed: boolean): void => {
	const wasAllowed = persistenceAllowed;
	persistenceAllowed = allowed;

	if (!allowed) {
		for (const key of SEARCH_STORAGE_KEYS) {
			try {
				localStorage.removeItem(key);
			} catch {
				// Non-fatal — nothing to clean up if storage is unavailable.
			}
		}
		return;
	}

	// Turning on (or confirming on): restore persisted state into each store.
	if (!wasAllowed) {
		for (const reload of reloaders) reload();
	}
};
