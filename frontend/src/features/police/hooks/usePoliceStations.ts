import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import {
	policeStationsService,
	type StationsQueryParams,
} from "../services/policeStations.service";

import { cacheConfig } from "@/shared/hooks/core/queryKeys";
import type {
	PoliceStationCreateRequest,
	PoliceStationUpdateRequest,
} from "@/shared/types/backend-api.types";

// Query keys
export const stationsQueryKeys = {
	all: ["police-stations"] as const,
	lists: () => [...stationsQueryKeys.all, "list"] as const,
	list: (params: StationsQueryParams) =>
		[...stationsQueryKeys.lists(), params] as const,
	details: () => [...stationsQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...stationsQueryKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated police stations
 */
export function useStations(params: StationsQueryParams = {}) {
	return useQuery({
		queryKey: stationsQueryKeys.list(params),
		queryFn: () => policeStationsService.getStations(params),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

/**
 * Hook to fetch a single police station
 */
export function useStation(id: number) {
	return useQuery({
		queryKey: stationsQueryKeys.detail(id),
		queryFn: () => policeStationsService.getStation(id),
		enabled: !!id,
		...cacheConfig.detail, // Use optimized cache settings
	});
}

/**
 * Hook to create a new police station
 */
export function useCreateStation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: PoliceStationCreateRequest) =>
			policeStationsService.createStation(data),
		onSuccess: async (newStation) => {
			// Add the new station to the cache
			queryClient.setQueryData(
				stationsQueryKeys.detail(newStation.id),
				newStation
			);

			// Invalidate all stations queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: stationsQueryKeys.all,
			});

			toast.success("Police station created successfully!");
		},
		onError: (error: unknown) => {
			logger.error("Failed to create police station", { error });
			toast.error(
				(error as Error)?.message || "Failed to create police station"
			);
		},
	});
}

/**
 * Hook to update a police station
 */
export function useUpdateStation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: PoliceStationUpdateRequest;
		}) => policeStationsService.updateStation(id, data),
		onSuccess: async (updatedStation) => {
			// Update the station in the cache
			queryClient.setQueryData(
				stationsQueryKeys.detail(updatedStation.id),
				updatedStation
			);

			// Invalidate all stations queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: stationsQueryKeys.all,
			});

			toast.success("Police station updated successfully!");
		},
		onError: (error: unknown) => {
			logger.error("Failed to update police station", { error });
			toast.error(
				(error as Error)?.message || "Failed to update police station"
			);
		},
	});
}

/**
 * Hook to delete a police station
 */
export function useDeleteStation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => policeStationsService.deleteStation(id),
		onSuccess: async (_, deletedId) => {
			// Remove the station from the cache
			queryClient.removeQueries({
				queryKey: stationsQueryKeys.detail(deletedId),
			});

			// Invalidate all stations queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: stationsQueryKeys.all,
			});

			toast.success("Police station deleted successfully!");
		},
		onError: (error: unknown) => {
			logger.error("Failed to delete police station", { error });

			// Handle specific error for stations with assigned officers
			const errorMessage = (error as Error)?.message || "";
			const errorStatus = (error as { status?: number })?.status;

			if (errorMessage.includes("officers") || errorStatus === 400) {
				toast.error(
					"Cannot delete station: Station has assigned officers"
				);
			} else {
				toast.error(errorMessage || "Failed to delete police station");
			}
		},
	});
}
