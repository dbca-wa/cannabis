import { APP_CONFIG } from "@/app/config/app.config";
import { policeStationsService } from "../services/policeStations.service";
import { useQuery } from "@tanstack/react-query";
import type { PoliceStation } from "@/shared/types/backend-api.types";

export const useStationById = (stationId: number | null) => {
	return useQuery({
		queryKey: ["police-stations", "detail", stationId],
		queryFn: async (): Promise<PoliceStation> => {
			if (!stationId) throw new Error("Station ID is required");
			return policeStationsService.getStation(stationId);
		},
		enabled: !!stationId,
		staleTime: APP_CONFIG.CACHE.DEFAULT_TTL,
		gcTime: APP_CONFIG.CACHE.DEFAULT_TTL * 2,
		retry: 2,
		retryDelay: 1000,
	});
};
