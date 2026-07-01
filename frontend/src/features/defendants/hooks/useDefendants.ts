import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getDefendants,
	getDefendantById,
	createDefendant,
	updateDefendant,
	deleteDefendant,
	type DefendantsQueryParams,
} from "../services/defendants.service";

import { cacheConfig } from "@/shared/hooks/core/queryKeys";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
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

/** Hook to fetch paginated defendants */
export const useDefendants = (params: DefendantsQueryParams = {}) => {
	return useQuery({
		queryKey: defendantsQueryKeys.list(params),
		queryFn: () => getDefendants(params),
		staleTime: 5 * 60 * 1000,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

/** Hook to fetch a single defendant by ID */
export const useDefendantById = (id: number | null) => {
	return useQuery({
		queryKey: defendantsQueryKeys.detail(id!),
		queryFn: () => getDefendantById(id!),
		enabled: !!id,
		...cacheConfig.detail,
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
};

/** Hook to create a new defendant */
export const useCreateDefendant = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: DefendantCreateRequest) => createDefendant(data),
		onSuccess: async (newDefendant) => {
			queryClient.setQueryData(
				defendantsQueryKeys.detail(newDefendant.id),
				newDefendant
			);
			await invalidateRelatedQueries(queryClient, "defendants");
			toast.success("Defendant created successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to create defendant:", error);
			toast.error((error as Error)?.message || "Failed to create defendant");
		},
	});
};

/** Hook to update a defendant */
export const useUpdateDefendant = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: DefendantUpdateRequest }) =>
			updateDefendant(id, data),
		onSuccess: async (updatedDefendant) => {
			queryClient.setQueryData(
				defendantsQueryKeys.detail(updatedDefendant.id),
				updatedDefendant
			);
			await invalidateRelatedQueries(queryClient, "defendants");
			toast.success("Defendant updated successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to update defendant:", error);
			toast.error((error as Error)?.message || "Failed to update defendant");
		},
	});
};

/** Hook to delete a defendant */
export const useDeleteDefendant = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => deleteDefendant(id),
		onSuccess: async (_, deletedId) => {
			queryClient.removeQueries({
				queryKey: defendantsQueryKeys.detail(deletedId),
			});
			await invalidateRelatedQueries(queryClient, "defendants");
			toast.success("Defendant deleted successfully!");
		},
		onError: (error: unknown) => {
			console.error("Failed to delete defendant:", error);

			const errorMessage = (error as Error)?.message || "";
			const errorStatus = (error as { status?: number })?.status;

			if (errorMessage.includes("cases") || errorStatus === 400) {
				toast.error("Cannot delete defendant: Defendant has associated cases");
			} else {
				toast.error(errorMessage || "Failed to delete defendant");
			}
		},
	});
};
