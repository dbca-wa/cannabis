export { dashboardService, DashboardService } from "./dashboard.service";

// Re-export types from backend-api.types.ts for convenience
export type {
	DashboardUserSubmissionsResponse,
	CertificateStatisticsResponse,
	RevenueStatisticsResponse,
} from "@/shared/types/backend-api.types";
