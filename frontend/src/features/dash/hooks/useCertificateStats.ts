import { useQuery } from "@tanstack/react-query";
import { getCertificateStats } from "../services/dashboard.service";
import { type CertificateStatisticsResponse } from "@/shared/types/backend-api.types";
import { dashboardKeys } from "./queryKeys";

export const useCertificateStats = () => {
	return useQuery<CertificateStatisticsResponse>({
		queryKey: dashboardKeys.statsCertificates(),
		staleTime: 5 * 60_000,
		queryFn: getCertificateStats,
	});
};
