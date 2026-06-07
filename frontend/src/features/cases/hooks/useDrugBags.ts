import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getDrugBags,
	getDrugBagById,
	createDrugBag,
	updateDrugBag,
	deleteDrugBag,
} from "../services/drugBags.service";
import {
	type DrugBagCreateRequest,
	type DrugBagUpdateRequest,
} from "@/shared/types/backend-api.types";
import { casesQueryKeys } from "./useCases";

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
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(newDrugBag.case),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(newDrugBag.case),
			});
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
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(updatedDrugBag.case),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(updatedDrugBag.case),
			});
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
		onSuccess: async ({ id, submissionId }) => {
			queryClient.removeQueries({
				queryKey: drugBagsQueryKeys.detail(id),
			});
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.list(submissionId),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(submissionId),
			});
			toast.success("Drug bag deleted successfully!");
		},
		onError: (error: unknown) => {
			toast.error(`Failed to delete drug bag: ${getErrorMessage(error)}`);
		},
	});

	return {
		drugBags: drugBagsQuery.data?.results || [],
		totalCount: drugBagsQuery.data?.count || 0,
		isLoading: drugBagsQuery.isLoading,
		isError: drugBagsQuery.isError,
		error: drugBagsQuery.error,
		isRefetching: drugBagsQuery.isRefetching,
		createDrugBag: createDrugBagMutation.mutate,
		updateDrugBag: updateDrugBagMutation.mutate,
		deleteDrugBag: deleteDrugBagMutation.mutate,
		isCreating: createDrugBagMutation.isPending,
		isUpdating: updateDrugBagMutation.isPending,
		isDeleting: deleteDrugBagMutation.isPending,
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
