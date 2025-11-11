import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { drugBagsService } from "../services/drugBags.service";
import {
	type DrugBagCreateRequest,
	type DrugBagUpdateRequest,
} from "@/shared/types/backend-api.types";
import { submissionsQueryKeys } from "./useSubmissions";

// Standardized query keys for drug bags
export const drugBagsQueryKeys = {
	all: ["drugbags"] as const,
	lists: () => [...drugBagsQueryKeys.all, "list"] as const,
	list: (submissionId: number) =>
		[...drugBagsQueryKeys.lists(), submissionId] as const,
	details: () => [...drugBagsQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...drugBagsQueryKeys.details(), id] as const,
};

// Hook for getting drug bags for a specific submission
export const useDrugBags = (submissionId: number | null) => {
	const queryClient = useQueryClient();

	const drugBagsQuery = useQuery({
		queryKey: drugBagsQueryKeys.list(submissionId!),
		queryFn: async () => {
			if (!submissionId)
				return { results: [], count: 0, next: null, previous: null };
			const result = await drugBagsService.getDrugBags(submissionId);
			if (!result.success) {
				throw new Error(result.error || "Failed to fetch drug bags");
			}
			return result.data;
		},
		enabled: !!submissionId,
		staleTime: 2 * 60 * 1000, // 2 minutes
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});

	// Create drug bag mutation
	const createDrugBagMutation = useMutation({
		mutationFn: async (drugBagData: DrugBagCreateRequest) => {
			logger.info("Creating drug bag", {
				submissionId: drugBagData.submission,
				sealTagNumbers: drugBagData.seal_tag_numbers,
			});
			const result = await drugBagsService.createDrugBag(drugBagData);
			if (!result.success) {
				throw new Error(result.error || "Failed to create drug bag");
			}
			return result.data;
		},
		onSuccess: async (newDrugBag) => {
			// Update specific drug bag cache
			queryClient.setQueryData(
				drugBagsQueryKeys.detail(newDrugBag.id),
				newDrugBag
			);

			// Invalidate drug bags list for this submission
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(newDrugBag.submission),
			});

			// Invalidate parent submission to update bag counts
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.detail(newDrugBag.submission),
			});

			toast.success(
				`Drug bag "${newDrugBag.seal_tag_numbers}" created successfully!`
			);
			logger.info("Drug bag created via hook", {
				drugBagId: newDrugBag.id,
				submissionId: newDrugBag.submission,
				sealTagNumbers: newDrugBag.seal_tag_numbers,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to create drug bag: ${errorMessage}`);
			logger.error("Create drug bag failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Update drug bag mutation
	const updateDrugBagMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: DrugBagUpdateRequest;
		}) => {
			logger.info("Updating drug bag", { drugBagId: id });
			const result = await drugBagsService.updateDrugBag(id, data);
			if (!result.success) {
				throw new Error(result.error || "Failed to update drug bag");
			}
			return result.data;
		},
		onSuccess: async (updatedDrugBag) => {
			// Update specific drug bag cache
			queryClient.setQueryData(
				drugBagsQueryKeys.detail(updatedDrugBag.id),
				updatedDrugBag
			);

			// Invalidate drug bags list for this submission
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(updatedDrugBag.submission),
			});

			// Invalidate parent submission to update any computed fields
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.detail(
					updatedDrugBag.submission
				),
			});

			toast.success(
				`Drug bag "${updatedDrugBag.seal_tag_numbers}" updated successfully!`
			);
			logger.info("Drug bag updated via hook", {
				drugBagId: updatedDrugBag.id,
				sealTagNumbers: updatedDrugBag.seal_tag_numbers,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to update drug bag: ${errorMessage}`);
			logger.error("Update drug bag failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Delete drug bag mutation
	const deleteDrugBagMutation = useMutation({
		mutationFn: async ({
			id,
			submissionId,
		}: {
			id: number;
			submissionId: number;
		}) => {
			logger.info("Deleting drug bag", { drugBagId: id });
			const result = await drugBagsService.deleteDrugBag(id);
			if (!result.success) {
				throw new Error(result.error || "Failed to delete drug bag");
			}
			return { id, submissionId };
		},
		onSuccess: async ({ id, submissionId }) => {
			// Remove from specific drug bag cache
			queryClient.removeQueries({
				queryKey: drugBagsQueryKeys.detail(id),
			});

			// Invalidate drug bags list for this submission
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(submissionId),
			});

			// Invalidate parent submission to update bag counts
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.detail(submissionId),
			});

			toast.success("Drug bag deleted successfully!");
			logger.info("Drug bag deleted via hook", {
				drugBagId: id,
				submissionId,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to delete drug bag: ${errorMessage}`);
			logger.error("Delete drug bag failed via hook", {
				error: errorMessage,
			});
		},
	});

	return {
		// Query data
		drugBags: drugBagsQuery.data?.results || [],
		totalCount: drugBagsQuery.data?.count || 0,

		// Query states
		isLoading: drugBagsQuery.isLoading,
		isError: drugBagsQuery.isError,
		error: drugBagsQuery.error,
		isRefetching: drugBagsQuery.isRefetching,

		// Mutations
		createDrugBag: createDrugBagMutation.mutate,
		updateDrugBag: updateDrugBagMutation.mutate,
		deleteDrugBag: deleteDrugBagMutation.mutate,

		// Mutation states
		isCreating: createDrugBagMutation.isPending,
		isUpdating: updateDrugBagMutation.isPending,
		isDeleting: deleteDrugBagMutation.isPending,

		// Refetch function
		refetch: drugBagsQuery.refetch,
	};
};

// Hook for getting a single drug bag by ID
export const useDrugBagById = (id: number | null) => {
	return useQuery({
		queryKey: drugBagsQueryKeys.detail(id!),
		queryFn: async () => {
			if (!id) return null;
			const result = await drugBagsService.getDrugBagById(id);
			if (!result.success) {
				throw new Error(result.error || "Failed to fetch drug bag");
			}
			return result.data;
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};
