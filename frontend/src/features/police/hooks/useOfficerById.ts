import { APP_CONFIG } from "@/app/config/app.config";
import { policeOfficersService } from "../services/policeOfficers.service";
import { useQuery } from "@tanstack/react-query";
import { policeOfficersQueryKeys } from "./usePoliceOfficers";
import type { PoliceOfficer } from "@/shared/types/backend-api.types";

export const useOfficerById = (officerId: number | null) => {
	return useQuery({
		queryKey: officerId ? policeOfficersQueryKeys.detail(officerId) : ["police-officers", "detail", null],
		queryFn: async (): Promise<PoliceOfficer> => {
			if (!officerId) throw new Error("Officer ID is required");
			return policeOfficersService.getOfficer(officerId);
		},
		enabled: !!officerId,
		staleTime: APP_CONFIG.CACHE.DEFAULT_TTL,
		gcTime: APP_CONFIG.CACHE.DEFAULT_TTL * 2,
		retry: 2,
		retryDelay: 1000,
	});
};
