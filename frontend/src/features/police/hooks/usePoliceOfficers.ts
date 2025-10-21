import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { policeOfficersService } from "../services/policeOfficers.service";
import { logger } from "@/shared/services/logger.service";

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
						first_name: officer.first_name,
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

			// Invalidate all officers queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: policeOfficersQueryKeys.all,
			});

			toast.success("Officer created successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to create officer:", error);
			toast.error(
				(error as any)?.response?.data?.message ||
					(error as any)?.message ||
					"Failed to create officer"
			);
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

			// Invalidate all officers queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: policeOfficersQueryKeys.all,
			});

			toast.success("Officer updated successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to update officer:", error);
			toast.error(
				(error as any)?.response?.data?.message ||
					(error as any)?.message ||
					"Failed to update officer"
			);
		},
	});
};

/**
 * Hook to delete a police officer
 */
export const useDeletePoliceOfficer = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => policeOfficersService.deleteOfficer(id),
		onSuccess: async (_, deletedId) => {
			// Remove the officer from the cache
			queryClient.removeQueries({
				queryKey: policeOfficersQueryKeys.detail(deletedId),
			});

			// Invalidate all officers queries to refresh everywhere
			queryClient.invalidateQueries({
				queryKey: policeOfficersQueryKeys.all,
			});

			toast.success("Officer deleted successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to delete officer:", error);
			toast.error(
				(error as any)?.response?.data?.message ||
					(error as any)?.message ||
					"Failed to delete officer"
			);
		},
	});
};
