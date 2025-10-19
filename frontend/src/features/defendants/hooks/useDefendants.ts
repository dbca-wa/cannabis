import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	DefendantsService,
	type DefendantsQueryParams,
} from "../services/defendants.service";

import { cacheConfig } from "@/shared/hooks/core/queryKeys";
import type {
	DefendantCreateRequest,
	DefendantUpdateRequest,
} from "@/shared/types/backend-api.types";

// Query keys following established patterns
export const defendantsQueryKeys = {
	all: ["defendants"] as const,
	lists: () => [...defendantsQueryKeys.all, "list"] as const,
	list: (params: DefendantsQueryParams) =>
		[...defendantsQueryKeys.lists(), params] as const,
	details: () => [...defendantsQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...defendantsQueryKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated defendants
 */
export function useDefendants(params: DefendantsQueryParams = {}) {
	return useQuery({
		queryKey: defendantsQueryKeys.list(params),
		queryFn: () => DefendantsService.getDefendants(params),
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
}

/**
 * Hook to fetch a single defendant by ID
 */
export function useDefendantById(id: number | null) {
	return useQuery({
		queryKey: defendantsQueryKeys.detail(id!),
		queryFn: () => DefendantsService.getDefendantById(id!),
		enabled: !!id,
		...cacheConfig.detail, // Use optimized cache settings
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
}

/**
 * Hook to create a new defendant
 */
export function useCreateDefendant() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: DefendantCreateRequest) =>
			DefendantsService.createDefendant(data),
		onSuccess: async (newDefendant) => {
			// Add the new defendant to the cache
			queryClient.setQueryData(
				defendantsQueryKeys.detail(newDefendant.id),
				newDefendant
			);

			// Invalidate all defendants list queries to refresh the table immediately
			queryClient.invalidateQueries({
				queryKey: defendantsQueryKeys.lists(),
			});

			toast.success("Defendant created successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to create defendant:", error);
			toast.error(
				(error as Error)?.message || "Failed to create defendant"
			);
		},
	});
}

/**
 * Hook to update a defendant
 */
export function useUpdateDefendant() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: DefendantUpdateRequest;
		}) => DefendantsService.updateDefendant(id, data),
		onSuccess: async (updatedDefendant) => {
			// Update the defendant in the cache
			queryClient.setQueryData(
				defendantsQueryKeys.detail(updatedDefendant.id),
				updatedDefendant
			);

			// Invalidate all defendants list queries to refresh the table immediately
			queryClient.invalidateQueries({
				queryKey: defendantsQueryKeys.lists(),
			});

			toast.success("Defendant updated successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to update defendant:", error);
			toast.error(
				(error as Error)?.message || "Failed to update defendant"
			);
		},
	});
}

/**
 * Hook to delete a defendant
 */
export function useDeleteDefendant() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => DefendantsService.deleteDefendant(id),
		onSuccess: async (_, deletedId) => {
			// Remove the defendant from the cache
			queryClient.removeQueries({
				queryKey: defendantsQueryKeys.detail(deletedId),
			});

			// Invalidate all defendants list queries to refresh the table immediately
			queryClient.invalidateQueries({
				queryKey: defendantsQueryKeys.lists(),
			});

			toast.success("Defendant deleted successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to delete defendant:", error);

			// Handle specific error for defendants with associated cases
			const errorMessage = (error as Error)?.message || "";
			const errorStatus = (error as { status?: number })?.status;

			if (errorMessage.includes("cases") || errorStatus === 400) {
				toast.error(
					"Cannot delete defendant: Defendant has associated cases"
				);
			} else {
				toast.error(errorMessage || "Failed to delete defendant");
			}
		},
	});
}
