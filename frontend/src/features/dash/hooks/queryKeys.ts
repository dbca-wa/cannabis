/**
 * Centralised query key factory for dashboard hooks.
 * Follows the structured pattern: all → lists/details → specific.
 */
export const dashboardKeys = {
	all: ["dashboard"] as const,
	mySubmissions: () => [...dashboardKeys.all, "my-submissions"] as const,
	stats: () => [...dashboardKeys.all, "stats"] as const,
	statsCertificates: () => [...dashboardKeys.stats(), "certificates"] as const,
	statsRevenue: () => [...dashboardKeys.stats(), "revenue"] as const,
	pendingAttention: () => [...dashboardKeys.all, "pending-attention"] as const,
	phaseStats: () => [...dashboardKeys.all, "phase-stats"] as const,
};
