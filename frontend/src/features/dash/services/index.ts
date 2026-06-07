export {
	getMySubmissions,
	getCertificateStats,
	getRevenueStats,
	getPendingAttention,
} from "./dashboard.service";

// Re-export types from backend-api.types.ts for convenience
export type {
	DashboardUserCasesResponse,
	CertificateStatisticsResponse,
	RevenueStatisticsResponse,
	PendingAttentionCase,
} from "@/shared/types/backend-api.types";
