import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assessmentsService } from "../services/assessments.service";
import {
	type BotanicalAssessmentRequest,
} from "@/shared/types/backend-api.types";
import { drugBagsQueryKeys } from "./useDrugBags";
import { submissionsQueryKeys } from "./useSubmissions";

// Standardized query keys for botanical assessments
export const botanicalAssessmentsQueryKeys = {
	all: ["botanical-assessments"] as const,
	details: () => [...botanicalAssessmentsQueryKeys.all, "detail"] as const,
	detail: (id: number) =>
		[...botanicalAssessmentsQueryKeys.details(), id] as const,
};

// Hook for getting a single botanical assessment by ID
export const useBotanicalAssessmentById = (id: number | null) => {
	return useQuery({
		queryKey: botanicalAssessmentsQueryKeys.detail(id!),
		queryFn: async () => {
			if (!id) return null;
			const result = await assessmentsService.getAssessmentById(id);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to fetch botanical assessment"
				);
			}
			return result.data;
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

// Hook for botanical assessment mutations
export const useBotanicalAssessmentMutations = () => {
	const queryClient = useQueryClient();

	// Create botanical assessment mutation
	const createAssessmentMutation = useMutation({
		mutationFn: async ({
			drugBagId,
			data,
		}: {
			drugBagId: number;
			data: BotanicalAssessmentRequest;
		}) => {
			logger.info("Creating botanical assessment", {
				drugBagId,
				determination: data.determination,
			});
			const result = await assessmentsService.createAssessment(
				drugBagId,
				data
			);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to create botanical assessment"
				);
			}
			return { assessment: result.data, drugBagId };
		},
		onSuccess: async ({ assessment, drugBagId }) => {
			// Update specific assessment cache
			queryClient.setQueryData(
				botanicalAssessmentsQueryKeys.detail(assessment.id),
				assessment
			);

			// Invalidate drug bag to show the new assessment
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.detail(drugBagId),
			});

			// Invalidate drug bags list to update assessment indicators
			// We need to find the submission ID from the drug bag
			const drugBagData = queryClient.getQueryData(
				drugBagsQueryKeys.detail(drugBagId)
			) as any;
			if (drugBagData?.submission) {
				queryClient.invalidateQueries({
					queryKey: drugBagsQueryKeys.list(drugBagData.submission),
				});

				// Invalidate parent submission to update cannabis_present and other computed fields
				queryClient.invalidateQueries({
					queryKey: submissionsQueryKeys.detail(
						drugBagData.submission
					),
				});
			}

			toast.success(`Botanical assessment created successfully!`);
			logger.info("Botanical assessment created via hook", {
				assessmentId: assessment.id,
				drugBagId,
				determination: assessment.determination,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(
				`Failed to create botanical assessment: ${errorMessage}`
			);
			logger.error("Create botanical assessment failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Update botanical assessment mutation
	const updateAssessmentMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: BotanicalAssessmentRequest;
		}) => {
			logger.info("Updating botanical assessment", { assessmentId: id });
			const result = await assessmentsService.updateAssessment(id, data);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to update botanical assessment"
				);
			}
			return result.data;
		},
		onSuccess: async (updatedAssessment) => {
			// Update specific assessment cache
			queryClient.setQueryData(
				botanicalAssessmentsQueryKeys.detail(updatedAssessment.id),
				updatedAssessment
			);

			// Find and invalidate related drug bag and submission
			// This is a bit complex since we need to find which drug bag this assessment belongs to
			// We'll invalidate all drug bags and submissions to be safe
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.all,
			});
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.all,
			});

			toast.success(`Botanical assessment updated successfully!`);
			logger.info("Botanical assessment updated via hook", {
				assessmentId: updatedAssessment.id,
				determination: updatedAssessment.determination,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(
				`Failed to update botanical assessment: ${errorMessage}`
			);
			logger.error("Update botanical assessment failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Delete botanical assessment mutation
	const deleteAssessmentMutation = useMutation({
		mutationFn: async (id: number) => {
			logger.info("Deleting botanical assessment", { assessmentId: id });
			const result = await assessmentsService.deleteAssessment(id);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to delete botanical assessment"
				);
			}
			return id;
		},
		onSuccess: async (assessmentId) => {
			// Remove from specific assessment cache
			queryClient.removeQueries({
				queryKey: botanicalAssessmentsQueryKeys.detail(assessmentId),
			});

			// Invalidate all drug bags and submissions to update assessment indicators
			queryClient.invalidateQueries({
				queryKey: drugBagsQueryKeys.all,
			});
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.all,
			});

			toast.success("Botanical assessment deleted successfully!");
			logger.info("Botanical assessment deleted via hook", {
				assessmentId,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(
				`Failed to delete botanical assessment: ${errorMessage}`
			);
			logger.error("Delete botanical assessment failed via hook", {
				error: errorMessage,
			});
		},
	});

	return {
		// Mutations
		createAssessment: createAssessmentMutation.mutate,
		updateAssessment: updateAssessmentMutation.mutate,
		deleteAssessment: deleteAssessmentMutation.mutate,

		// Mutation states
		isCreating: createAssessmentMutation.isPending,
		isUpdating: updateAssessmentMutation.isPending,
		isDeleting: deleteAssessmentMutation.isPending,
	};
};
