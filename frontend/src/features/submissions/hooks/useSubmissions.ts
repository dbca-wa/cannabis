import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { submissionsService } from "../services/submissions.service";
import {
	type SubmissionsSearchParams,
	type SubmissionCreateRequest,
	type SubmissionUpdateRequest,
	type WorkflowActionRequest,
	type SubmissionPhase,
} from "@/shared/types/backend-api.types";

// Standardized query keys following established patterns
export const submissionsQueryKeys = {
	all: ["submissions"] as const,
	lists: () => [...submissionsQueryKeys.all, "list"] as const,
	list: (params: SubmissionsSearchParams) =>
		[...submissionsQueryKeys.lists(), params] as const,
	details: () => [...submissionsQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...submissionsQueryKeys.details(), id] as const,
};

export const useSubmissions = (params: SubmissionsSearchParams = {}) => {
	const queryClient = useQueryClient();

	// Query for fetching submissions with pagination and filtering
	const submissionsQuery = useQuery({
		queryKey: submissionsQueryKeys.list(params),
		queryFn: async () => {
			const result = await submissionsService.getSubmissions(params);
			if (!result.success) {
				throw new Error(result.error || "Failed to fetch submissions");
			}
			return result.data;
		},
		staleTime: 2 * 60 * 1000, // 2 minutes (submissions change more frequently)
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});

	// Create submission mutation
	const createSubmissionMutation = useMutation({
		mutationFn: async (submissionData: SubmissionCreateRequest) => {
			logger.info("Creating submission", {
				caseNumber: submissionData.case_number,
			});
			const result = await submissionsService.createSubmission(
				submissionData
			);
			if (!result.success) {
				throw new Error(result.error || "Failed to create submission");
			}
			return result.data;
		},
		onSuccess: async (newSubmission) => {
			// Update specific submission cache
			queryClient.setQueryData(
				submissionsQueryKeys.detail(newSubmission.id),
				newSubmission
			);

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			// Invalidate all submissions queries to refresh search comboboxes
			queryClient.invalidateQueries({
				queryKey: ['submissions'],
			});

			toast.success(
				`Submission "${newSubmission.case_number}" created successfully!`
			);
			logger.info("Submission created via hook", {
				submissionId: newSubmission.id,
				caseNumber: newSubmission.case_number,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to create submission: ${errorMessage}`);
			logger.error("Create submission failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Update submission mutation
	const updateSubmissionMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: SubmissionUpdateRequest;
		}) => {
			logger.info("Updating submission", { submissionId: id });
			const result = await submissionsService.updateSubmission(id, data);
			if (!result.success) {
				throw new Error(result.error || "Failed to update submission");
			}
			return result.data;
		},
		onSuccess: async (updatedSubmission) => {
			// Update specific submission cache
			queryClient.setQueryData(
				submissionsQueryKeys.detail(updatedSubmission.id),
				updatedSubmission
			);

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			// Invalidate all submissions queries to refresh search comboboxes
			queryClient.invalidateQueries({
				queryKey: ['submissions'],
			});

			toast.success(
				`Submission "${updatedSubmission.case_number}" updated successfully!`
			);
			logger.info("Submission updated via hook", {
				submissionId: updatedSubmission.id,
				caseNumber: updatedSubmission.case_number,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to update submission: ${errorMessage}`);
			logger.error("Update submission failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Delete submission mutation
	const deleteSubmissionMutation = useMutation({
		mutationFn: async (id: number) => {
			logger.info("Deleting submission", { submissionId: id });
			const result = await submissionsService.deleteSubmission(id);
			if (!result.success) {
				throw new Error(result.error || "Failed to delete submission");
			}
			return result.data;
		},
		onSuccess: async (_, submissionId) => {
			// Remove from specific submission cache
			queryClient.removeQueries({
				queryKey: submissionsQueryKeys.detail(submissionId),
			});

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			// Invalidate all submissions queries to refresh search comboboxes
			queryClient.invalidateQueries({
				queryKey: ['submissions'],
			});

			toast.success("Submission deleted successfully!");
			logger.info("Submission deleted via hook", {
				submissionId,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to delete submission: ${errorMessage}`);
			logger.error("Delete submission failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Workflow action mutation
	const workflowActionMutation = useMutation({
		mutationFn: async ({
			id,
			action,
		}: {
			id: number;
			action: WorkflowActionRequest;
		}) => {
			logger.info("Executing workflow action", {
				submissionId: id,
				action: action.action,
			});
			const result = await submissionsService.executeWorkflowAction(
				id,
				action
			);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to execute workflow action"
				);
			}
			return result.data;
		},
		onSuccess: async (response, { id }) => {
			// Invalidate specific submission to refresh its data
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.detail(id),
			});

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			toast.success(response.message);
			logger.info("Workflow action executed via hook", {
				submissionId: id,
				response,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to execute workflow action: ${errorMessage}`);
			logger.error("Workflow action failed via hook", {
				error: errorMessage,
			});
		},
	});

	return {
		// Query data
		submissions: submissionsQuery.data?.results || [],
		totalCount: submissionsQuery.data?.count || 0,
		hasNextPage: !!submissionsQuery.data?.next,
		hasPreviousPage: !!submissionsQuery.data?.previous,

		// Query states
		isLoading: submissionsQuery.isLoading,
		isError: submissionsQuery.isError,
		error: submissionsQuery.error,
		isRefetching: submissionsQuery.isRefetching,

		// Mutations
		createSubmission: createSubmissionMutation.mutate,
		updateSubmission: updateSubmissionMutation.mutate,
		deleteSubmission: deleteSubmissionMutation.mutate,
		executeWorkflowAction: workflowActionMutation.mutate,

		// Mutation states
		isCreating: createSubmissionMutation.isPending,
		isUpdating: updateSubmissionMutation.isPending,
		isDeleting: deleteSubmissionMutation.isPending,
		isExecutingWorkflow: workflowActionMutation.isPending,

		// Refetch function
		refetch: submissionsQuery.refetch,
	};
};

// Hook for getting a single submission by ID with phase history
export const useSubmissionById = (id: number | null) => {
	return useQuery({
		queryKey: submissionsQueryKeys.detail(id!),
		queryFn: async () => {
			if (!id) return null;
			const result = await submissionsService.getSubmissionById(id);
			if (!result.success) {
				throw new Error(result.error || "Failed to fetch submission");
			}
			return result.data;
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

// Hook for getting phase history for a submission
export const usePhaseHistory = (
	submissionId: number | null,
	params: { action?: string; user?: number; ordering?: string } = {}
) => {
	return useQuery({
		queryKey: [
			...submissionsQueryKeys.detail(submissionId!),
			"phase-history",
			params,
		],
		queryFn: async () => {
			if (!submissionId) return [];
			const result = await submissionsService.getPhaseHistory(
				submissionId,
				params
			);
			if (!result.success) {
				throw new Error(
					result.error || "Failed to fetch phase history"
				);
			}
			return result.data;
		},
		enabled: !!submissionId,
		staleTime: 2 * 60 * 1000, // 2 minutes (phase history changes frequently)
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

// Hook for advancing submission to next phase
export const useAdvancePhase = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (submissionId: number) => {
			logger.info("Advancing submission phase", { submissionId });

			// TODO: Implement backend endpoint POST /api/v1/submissions/{id}/advance/
			// For now, throw error to indicate not implemented
			throw new Error(
				"Phase advancement endpoint not yet implemented in backend"
			);

			// Future implementation:
			// const result = await submissionsService.advancePhase(submissionId);
			// if (!result.success) {
			//     throw new Error(result.error || "Failed to advance phase");
			// }
			// return result.data;
		},
		onSuccess: async (updatedSubmission, submissionId) => {
			// Update specific submission cache
			queryClient.setQueryData(
				submissionsQueryKeys.detail(submissionId),
				updatedSubmission
			);

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			// Invalidate phase history to refresh timeline
			queryClient.invalidateQueries({
				queryKey: [
					...submissionsQueryKeys.detail(submissionId),
					"phase-history",
				],
			});

			// Invalidate all submissions queries to refresh search comboboxes
			queryClient.invalidateQueries({
				queryKey: ['submissions'],
			});

			toast.success("Phase advanced successfully!");
			logger.info("Phase advanced via hook", {
				submissionId,
				// newPhase: updatedSubmission.phase,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to advance phase: ${errorMessage}`);
			logger.error("Advance phase failed via hook", {
				error: errorMessage,
			});
		},
	});
};

// Hook for sending submission back to earlier phase
export const useSendBack = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			submissionId,
			targetPhase,
			reason,
		}: {
			submissionId: number;
			targetPhase: SubmissionPhase;
			reason: string;
		}) => {
			logger.info("Sending submission back", {
				submissionId,
				targetPhase,
				reason,
			});

			const result = await submissionsService.sendBack(submissionId, {
				target_phase: targetPhase,
				reason,
			});

			if (!result.success) {
				throw new Error(result.error || "Failed to send back");
			}

			return result.data;
		},
		onSuccess: async (response, { submissionId }) => {
			// Invalidate specific submission to refresh its data
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.detail(submissionId),
			});

			// Invalidate submissions list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: submissionsQueryKeys.lists(),
			});

			// Invalidate phase history to refresh timeline
			queryClient.invalidateQueries({
				queryKey: [
					...submissionsQueryKeys.detail(submissionId),
					"phase-history",
				],
			});

			// Invalidate all submissions queries to refresh search comboboxes
			queryClient.invalidateQueries({
				queryKey: ['submissions'],
			});

			toast.success(response.message);
			logger.info("Submission sent back via hook", {
				submissionId,
				newPhase: response.new_phase,
				sentBackBy: response.sent_back_by,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to send back: ${errorMessage}`);
			logger.error("Send back failed via hook", {
				error: errorMessage,
			});
		},
	});
};

// Hook for searching submissions (alias for useSubmissions with search focus)
export const useSubmissionSearch = (params: SubmissionsSearchParams) => {
	return useSubmissions(params);
};
