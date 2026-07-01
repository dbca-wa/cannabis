import type { QueryClient } from "@tanstack/react-query";

/**
 * Root query keys for every cached entity — the single source of truth for
 * cross-feature cache invalidation.
 *
 * Each feature still owns its granular key factory (lists, details, searches).
 * These roots match the first segment of those factories, so invalidating a
 * root refreshes every list/detail/search beneath it via TanStack's prefix
 * matching.
 */
export const ROOT_QUERY_KEYS = {
	cases: ["cases"],
	certificates: ["certificates"],
	invoices: ["invoices"],
	defendants: ["defendants"],
	users: ["users"],
	policeOfficers: ["police-officers"],
	policeStations: ["police-stations"],
	drugBags: ["drugbags"],
	botanicalAssessments: ["botanical-assessments"],
	signatures: ["signature"],
	dashboard: ["dashboard"],
} as const satisfies Record<string, readonly [string]>;

export type CacheEntity = keyof typeof ROOT_QUERY_KEYS;

/**
 * For each entity, the entities whose cached data must be refreshed when it
 * changes — the entity itself plus anything that embeds or aggregates it.
 *
 * Relationships (why each dependency exists):
 * - Cases are summarised on the dashboard (phase counts, revenue, attention).
 * - Certificates/invoices are embedded in case detail and feed dashboard stats.
 * - Defendants, officers and stations are embedded in case records.
 * - Officers belong to stations (rosters) and stations are named on officers.
 * - Users (creator, botanist, assignee) are named on case records.
 * - Drug bags and assessments are nested under a case.
 */
const RELATED_ENTITIES = {
	cases: ["cases", "dashboard"],
	certificates: ["certificates", "cases", "dashboard"],
	invoices: ["invoices", "cases", "dashboard"],
	defendants: ["defendants", "cases"],
	users: ["users", "cases"],
	policeOfficers: ["policeOfficers", "policeStations", "cases"],
	policeStations: ["policeStations", "policeOfficers", "cases"],
	drugBags: ["drugBags", "cases"],
	botanicalAssessments: ["botanicalAssessments", "drugBags", "cases"],
	signatures: ["signatures"],
	dashboard: ["dashboard"],
} as const satisfies Record<CacheEntity, readonly CacheEntity[]>;

/**
 * Invalidate the caches for an entity and everything that embeds or aggregates
 * it. Call from a mutation's onSuccess handler so no view shows stale data
 * after a create, update or delete.
 */
export const invalidateRelatedQueries = async (
	queryClient: QueryClient,
	entity: CacheEntity
): Promise<void> => {
	await Promise.all(
		RELATED_ENTITIES[entity].map((name) =>
			queryClient.invalidateQueries({ queryKey: ROOT_QUERY_KEYS[name] })
		)
	);
};
