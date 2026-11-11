import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getDefendants,
	getDefendantById,
	createDefendant,
	updateDefendant,
	deleteDefendant,
	getDefendantUsage,
	type DefendantsQueryParams,
} from "../services/defendants.service";

import { cacheConfig } from "@/shared/hooks/core/queryKeys";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { getErrorMessage } from "@/shared/utils/error.utils";
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
		mutationFn: ({
			id,
			replacementId,
		}: {
			id: number;
			replacementId?: number | null;
		}) => deleteDefendant(id, replacementId),
		onSuccess: async (_, { id }) => {
			queryClient.removeQueries({
				queryKey: defendantsQueryKeys.detail(id),
			});
			// Moved cases are refreshed too.
			await invalidateRelatedQueries(queryClient, "defendants");
			toast.success("Defendant deleted");
		},
		onError: (error: unknown) => {
			// The server says why, e.g. which cases need a replacement.
			toast.error(getErrorMessage(error) || "Failed to delete defendant");
		},
	});
};

/** The cases that name a defendant, shown before deleting them. */
export const useDefendantUsage = (id: number | null) =>
	useQuery({
		queryKey: [...defendantsQueryKeys.detail(id ?? 0), "usage"],
		queryFn: () => getDefendantUsage(id!),
		enabled: !!id,
		staleTime: 0,
	});
