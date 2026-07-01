import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getDrugBags,
	getDrugBagById,
	createDrugBag,
	updateDrugBag,
	deleteDrugBag,
	batchCreateDrugBags,
} from "../services/drugBags.service";
import {
	type DrugBagCreateRequest,
	type DrugBagUpdateRequest,
} from "@/shared/types/backend-api.types";
import type { DrugBagBatchCreateRequest } from "../types/drugBags.types";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";

export const drugBagsQueryKeys = {
	all: ["drugbags"] as const,
	lists: () => [...drugBagsQueryKeys.all, "list"] as const,
	list: (submissionId: number) =>
		[...drugBagsQueryKeys.lists(), submissionId] as const,
	details: () => [...drugBagsQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...drugBagsQueryKeys.details(), id] as const,
};

export const useDrugBags = (submissionId: number | null) => {
	const queryClient = useQueryClient();

	const drugBagsQuery = useQuery({
		queryKey: drugBagsQueryKeys.list(submissionId!),
		queryFn: () => getDrugBags(submissionId!),
		enabled: !!submissionId,
		staleTime: 2 * 60_000,
	});

	const createDrugBagMutation = useMutation({
		mutationFn: (drugBagData: DrugBagCreateRequest) =>
			createDrugBag(drugBagData),
		onSuccess: async (newDrugBag) => {
			queryClient.setQueryData(
				drugBagsQueryKeys.detail(newDrugBag.id),
				newDrugBag
			);
			await invalidateRelatedQueries(queryClient, "drugBags");
			toast.success(
				`Drug bag "${newDrugBag.seal_tag_numbers}" created successfully!`
			);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to create drug bag: ${getErrorMessage(error)}`);
		},
	});

	const updateDrugBagMutation = useMutation({
		mutationFn: ({ id, data }: { id: number; data: DrugBagUpdateRequest }) =>
			updateDrugBag(id, data),
		onSuccess: async (updatedDrugBag) => {
			queryClient.setQueryData(
				drugBagsQueryKeys.detail(updatedDrugBag.id),
				updatedDrugBag
			);
			await invalidateRelatedQueries(queryClient, "drugBags");
			toast.success(
				`Drug bag "${updatedDrugBag.seal_tag_numbers}" updated successfully!`
			);
		},
		onError: (error: unknown) => {
			toast.error(`Failed to update drug bag: ${getErrorMessage(error)}`);
		},
	});

	const deleteDrugBagMutation = useMutation({
		mutationFn: async ({
			id,
			submissionId,
		}: {
			id: number;
			submissionId: number;
		}) => {
			await deleteDrugBag(id);
			return { id, submissionId };
		},
		onSuccess: async ({ id }) => {
			queryClient.removeQueries({
				queryKey: drugBagsQueryKeys.detail(id),
			});
			await invalidateRelatedQueries(queryClient, "drugBags");
			toast.success("Drug bag deleted successfully!");
		},
		onError: (error: unknown) => {
			toast.error(`Failed to delete drug bag: ${getErrorMessage(error)}`);
		},
	});

	const batchCreateMutation = useMutation({
		mutationFn: ({
			caseId,
			data,
		}: {
			caseId: number;
			data: DrugBagBatchCreateRequest;
		}) => batchCreateDrugBags(caseId, data),
		onSuccess: async () => {
			await invalidateRelatedQueries(queryClient, "drugBags");
			toast.success("Bags created successfully!");
		},
		// Errors are surfaced by the caller (AssessmentStep maps per-bag tag
		// conflicts back to the highlighted bag sections), so no toast here.
	});

	return {
		drugBags: drugBagsQuery.data?.results || [],
		totalCount: drugBagsQuery.data?.count || 0,
		isLoading: drugBagsQuery.isLoading,
		isError: drugBagsQuery.isError,
		error: drugBagsQuery.error,
		isRefetching: drugBagsQuery.isRefetching,
		createDrugBag: createDrugBagMutation.mutateAsync,
		updateDrugBag: updateDrugBagMutation.mutateAsync,
		deleteDrugBag: deleteDrugBagMutation.mutateAsync,
		batchCreateDrugBags: batchCreateMutation.mutateAsync,
		isCreating: createDrugBagMutation.isPending,
		isUpdating: updateDrugBagMutation.isPending,
		isDeleting: deleteDrugBagMutation.isPending,
		isBatchCreating: batchCreateMutation.isPending,
		refetch: drugBagsQuery.refetch,
	};
};

export const useDrugBagById = (id: number | null) => {
	return useQuery({
		queryKey: drugBagsQueryKeys.detail(id!),
		queryFn: () => getDrugBagById(id!),
		enabled: !!id,
		staleTime: 5 * 60_000,
	});
};
