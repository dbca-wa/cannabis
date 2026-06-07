import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getAssessmentById,
	createAssessment,
	updateAssessment,
	deleteAssessment,
} from "../services/assessments.service";
import {
	type BotanicalAssessmentRequest,
	type DrugBag,
} from "@/shared/types/backend-api.types";
import { drugBagsQueryKeys } from "./useDrugBags";
import { casesQueryKeys } from "./useCases";

export const botanicalAssessmentsQueryKeys = {
	all: ["botanical-assessments"] as const,
	details: () => [...botanicalAssessmentsQueryKeys.all, "detail"] as const,
	detail: (id: number) =>
		[...botanicalAssessmentsQueryKeys.details(), id] as const,
};

export const useBotanicalAssessmentById = (id: number | null) => {
	return useQuery({
		queryKey: botanicalAssessmentsQueryKeys.detail(id!),
		queryFn: () => getAssessmentById(id!),
		enabled: !!id,
		staleTime: 5 * 60_000,
	});
};

export const useBotanicalAssessmentMutations = () => {
	const queryClient = useQueryClient();

	const createAssessmentMutation = useMutation({
		mutationFn: async ({
			drugBagId,
			data,
		}: {
			drugBagId: number;
			data: BotanicalAssessmentRequest;
		}) => {
			const assessment = await createAssessment(drugBagId, data);
			return { assessment, drugBagId };
		},
		onSuccess: async ({ assessment, drugBagId }) => {
			queryClient.setQueryData(
				botanicalAssessmentsQueryKeys.detail(assessment.id),
				assessment
			);
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.detail(drugBagId),
			});

			const drugBagData = queryClient.getQueryData(
				drugBagsQueryKeys.detail(drugBagId)
			) as DrugBag | undefined;
			if (drugBagData?.case) {
				queryClient.invalidateQueries({
					queryKey: drugBagsQueryKeys.list(drugBagData.case),
				});
				queryClient.invalidateQueries({
					queryKey: casesQueryKeys.detail(drugBagData.case),
				});
			}

			toast.success("Botanical assessment created successfully!");
		},
		onError: (error: unknown) => {
			toast.error(
				`Failed to create botanical assessment: ${getErrorMessage(error)}`
			);
		},
	});

	const updateAssessmentMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: number;
			data: BotanicalAssessmentRequest;
		}) => updateAssessment(id, data),
		onSuccess: async (updatedAssessment) => {
			queryClient.setQueryData(
				botanicalAssessmentsQueryKeys.detail(updatedAssessment.id),
				updatedAssessment
			);
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.all,
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.all,
			});
			toast.success("Botanical assessment updated successfully!");
		},
		onError: (error: unknown) => {
			toast.error(
				`Failed to update botanical assessment: ${getErrorMessage(error)}`
			);
		},
	});

	const deleteAssessmentMutation = useMutation({
		mutationFn: async (id: number) => {
			await deleteAssessment(id);
			return id;
		},
		onSuccess: async (assessmentId) => {
			queryClient.removeQueries({
				queryKey: botanicalAssessmentsQueryKeys.detail(assessmentId),
			});
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.all,
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.all,
			});
			toast.success("Botanical assessment deleted successfully!");
		},
		onError: (error: unknown) => {
			toast.error(
				`Failed to delete botanical assessment: ${getErrorMessage(error)}`
			);
		},
	});

	return {
		createAssessment: createAssessmentMutation.mutate,
		updateAssessment: updateAssessmentMutation.mutate,
		deleteAssessment: deleteAssessmentMutation.mutate,
		isCreating: createAssessmentMutation.isPending,
		isUpdating: updateAssessmentMutation.isPending,
		isDeleting: deleteAssessmentMutation.isPending,
	};
};
