import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { policeOfficersService } from "../services/policeOfficers.service";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";

import type {
	PoliceOfficerCreateRequest,
	PoliceOfficerUpdateRequest,
	PoliceOfficerSearchParams,
} from "@/shared/types/backend-api.types";

// Query keys for police officers
export const policeOfficersQueryKeys = {
	all: ["police-officers"] as const,
	lists: () => [...policeOfficersQueryKeys.all, "list"] as const,
	list: (params: PoliceOfficerSearchParams) =>
		[...policeOfficersQueryKeys.lists(), params] as const,
	details: () => [...policeOfficersQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...policeOfficersQueryKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated list of police officers
 */
export const usePoliceOfficers = (params: PoliceOfficerSearchParams = {}) => {
	return useQuery({
		queryKey: policeOfficersQueryKeys.list(params),
		queryFn: async () => {
			const response = await policeOfficersService.getOfficers(params);
			logger.debug("Police Officers API Response", {
				count: response.count,
				totalOfficers: response.results?.length || 0,
				officers:
					response.results?.map((officer) => ({
						id: officer.id,
						badge_number: officer.badge_number,
						given_names: officer.given_names,
						last_name: officer.last_name,
						full_name: officer.full_name,
						rank: officer.rank,
						rank_display: officer.rank_display,
						is_sworn: officer.is_sworn,
						station: officer.station,
						station_name: officer.station_name,
					})) || [],
			});
			return response;
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

/**
 * Hook to fetch a single police officer by ID
 */
export const usePoliceOfficer = (id: number) => {
	return useQuery({
		queryKey: policeOfficersQueryKeys.detail(id),
		queryFn: () => policeOfficersService.getOfficer(id),
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

/**
 * Hook to create a new police officer
 */
export const useCreatePoliceOfficer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: PoliceOfficerCreateRequest) =>
			policeOfficersService.createOfficer(data),
		onSuccess: async (newOfficer) => {
			// Add the new officer to the cache
			queryClient.setQueryData(
				policeOfficersQueryKeys.detail(newOfficer.id),
				newOfficer
			);

			// Refetches every officer query in use, including an open combobox
			// search, and marks the rest stale so they refetch when next shown.
			// Inactive queries are not refetched now: the detail entry seeded
			// above has no query function, so forcing it to refetch fails.
			await invalidateRelatedQueries(queryClient, "policeOfficers");

			toast.success("Officer created successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to create officer:", error);
			toast.error(getErrorMessage(error) || "Failed to create officer");
		},
	});
};

/**
 * Hook to update an existing police officer
 */
export const useUpdatePoliceOfficer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: PoliceOfficerUpdateRequest;
		}) => policeOfficersService.updateOfficer(id, data),
		onSuccess: async (updatedOfficer) => {
			// Update the officer in the cache
			queryClient.setQueryData(
				policeOfficersQueryKeys.detail(updatedOfficer.id),
				updatedOfficer
			);

			await invalidateRelatedQueries(queryClient, "policeOfficers");

			toast.success("Officer updated successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to update officer:", error);
			toast.error(getErrorMessage(error) || "Failed to update officer");
		},
	});
};

/**
 * Hook to delete a police officer
 */
export const useDeletePoliceOfficer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			replacementId,
		}: {
			id: number;
			replacementId?: number | null;
		}) => policeOfficersService.deleteOfficer(id, replacementId),
		onSuccess: async (_, { id }) => {
			// Remove the officer from the cache
			queryClient.removeQueries({
				queryKey: policeOfficersQueryKeys.detail(id),
			});

			// Moved cases are refreshed too.
			await invalidateRelatedQueries(queryClient, "policeOfficers");

			toast.success("Officer deleted");
		},
		onError: (error: unknown) => {
			// The server says why, e.g. which cases need a replacement.
			toast.error(getErrorMessage(error) || "Failed to delete officer");
		},
	});
};

/** The cases that name an officer, shown before deleting them. */
export const useOfficerUsage = (id: number | null) =>
	useQuery({
		queryKey: [...policeOfficersQueryKeys.detail(id ?? 0), "usage"],
		queryFn: () => policeOfficersService.getOfficerUsage(id!),
		enabled: !!id,
		staleTime: 0,
	});
