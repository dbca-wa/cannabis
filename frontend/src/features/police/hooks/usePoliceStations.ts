import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import {
	policeStationsService,
	type StationsQueryParams,
} from "../services/policeStations.service";

import { cacheConfig } from "@/shared/hooks/core/queryKeys";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { getErrorMessage } from "@/shared/utils/error.utils";
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

			await invalidateRelatedQueries(queryClient, "policeStations");

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

			await invalidateRelatedQueries(queryClient, "policeStations");

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
		mutationFn: ({
			id,
			replacementId,
		}: {
			id: number;
			replacementId?: number | null;
		}) => policeStationsService.deleteStation(id, replacementId),
		onSuccess: async (_, { id }) => {
			// Remove the station from the cache
			queryClient.removeQueries({
				queryKey: stationsQueryKeys.detail(id),
			});

			// Moved cases and officers are refreshed too.
			await invalidateRelatedQueries(queryClient, "policeStations");

			toast.success("Police station deleted");
		},
		onError: (error: unknown) => {
			logger.error("Failed to delete police station", { error });
			// The server says why, e.g. which cases need a replacement.
			toast.error(getErrorMessage(error) || "Failed to delete police station");
		},
	});
}

/** The cases and officers that use a station, shown before deleting it. */
export function useStationUsage(id: number | null) {
	return useQuery({
		queryKey: [...stationsQueryKeys.detail(id ?? 0), "usage"],
		queryFn: () => policeStationsService.getStationUsage(id!),
		enabled: !!id,
		staleTime: 0,
	});
}
