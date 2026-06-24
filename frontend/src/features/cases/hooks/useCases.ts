import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	getCases,
	getCaseById,
	createCase,
	updateCase,
	deleteCase,
	executeWorkflowAction,
	sendBack,
	getPhaseHistory,
} from "../services/cases.service";
import {
	type CasesSearchParams,
	type CaseCreateRequest,
	type CaseUpdateRequest,
	type WorkflowActionRequest,
	type CasePhase,
} from "@/shared/types/backend-api.types";

// Standardised query keys following established patterns
export const casesQueryKeys = {
	all: ["cases"] as const,
	lists: () => [...casesQueryKeys.all, "list"] as const,
	list: (params: CasesSearchParams) =>
		[...casesQueryKeys.lists(), params] as const,
	details: () => [...casesQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...casesQueryKeys.details(), id] as const,
};

export const useCases = (params: CasesSearchParams = {}) => {
	const queryClient = useQueryClient();

	// Query for fetching cases with pagination and filtering
	const submissionsQuery = useQuery({
		queryKey: casesQueryKeys.list(params),
		queryFn: () => getCases(params),
		staleTime: 2 * 60 * 1000,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});

	// Create case mutation
	const createCaseMutation = useMutation({
		mutationFn: async (submissionData: CaseCreateRequest) => {
			logger.info("Creating case", {
				caseNumber: submissionData.case_number,
			});
			return createCase(submissionData);
		},
		onSuccess: async (newCase) => {
			queryClient.setQueryData(casesQueryKeys.detail(newCase.id), newCase);
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: ["cases"],
			});
			toast.success(`Case "${newCase.case_number}" created successfully!`);
			logger.info("Case created via hook", {
				submissionId: newCase.id,
				caseNumber: newCase.case_number,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to create case: ${errorMessage}`);
			logger.error("Create case failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Update case mutation
	const updateCaseMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: number;
			data: CaseUpdateRequest;
		}) => {
			logger.info("Updating case", { submissionId: id });
			return updateCase(id, data);
		},
		onSuccess: async (updatedCase) => {
			// Invalidate the detail query to refetch full case data (with nested relations)
			// instead of replacing cache with partial PATCH response
			await queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(updatedCase.id),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: ["cases"],
			});
			toast.success(`Case "${updatedCase.case_number}" updated successfully!`);
			logger.info("Case updated via hook", {
				submissionId: updatedCase.id,
				caseNumber: updatedCase.case_number,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to update case: ${errorMessage}`);
			logger.error("Update case failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Delete case mutation
	const deleteCaseMutation = useMutation({
		mutationFn: async (id: number) => {
			logger.info("Deleting case", { submissionId: id });
			return deleteCase(id);
		},
		onSuccess: async (_, submissionId) => {
			queryClient.removeQueries({
				queryKey: casesQueryKeys.detail(submissionId),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: ["cases"],
			});
			toast.success("Case deleted successfully!");
			logger.info("Case deleted via hook", { submissionId });
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to delete case: ${errorMessage}`);
			logger.error("Delete case failed via hook", {
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
			return executeWorkflowAction(id, action);
		},
		onSuccess: async (response, { id }) => {
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(id),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
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
		cases: submissionsQuery.data?.results || [],
		totalCount: submissionsQuery.data?.count || 0,
		hasNextPage: !!submissionsQuery.data?.next,
		hasPreviousPage: !!submissionsQuery.data?.previous,

		// Query states
		isLoading: submissionsQuery.isLoading,
		isError: submissionsQuery.isError,
		error: submissionsQuery.error,
		isRefetching: submissionsQuery.isRefetching,

		// Mutations
		createCase: createCaseMutation.mutate,
		updateCase: updateCaseMutation.mutate,
		deleteCase: deleteCaseMutation.mutate,
		executeWorkflowAction: workflowActionMutation.mutate,

		// Mutation states
		isCreating: createCaseMutation.isPending,
		isUpdating: updateCaseMutation.isPending,
		isDeleting: deleteCaseMutation.isPending,
		isExecutingWorkflow: workflowActionMutation.isPending,

		// Refetch function
		refetch: submissionsQuery.refetch,
	};
};

// Hook for getting a single case by ID with phase history
export const useCaseById = (id: number | null) => {
	return useQuery({
		queryKey: casesQueryKeys.detail(id!),
		queryFn: () => getCaseById(id!),
		enabled: !!id,
		staleTime: 5 * 60 * 1000,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

// Hook for getting phase history for a case
export const usePhaseHistory = (
	submissionId: number | null,
	params: { action?: string; user?: number; ordering?: string } = {}
) => {
	return useQuery({
		queryKey: [
			...casesQueryKeys.detail(submissionId!),
			"phase-history",
			params,
		],
		queryFn: () => getPhaseHistory(submissionId!, params),
		enabled: !!submissionId,
		staleTime: 2 * 60 * 1000,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

// Hook for advancing case to next phase
export const useAdvancePhase = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (submissionId: number) => {
			logger.info("Advancing case phase", { submissionId });
			// TODO: Implement backend endpoint POST /cases/{id}/advance/
			throw new Error(
				"Phase advancement endpoint not yet implemented in backend"
			);
		},
		onSuccess: async (updatedCase, submissionId) => {
			queryClient.setQueryData(
				casesQueryKeys.detail(submissionId),
				updatedCase
			);
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: [...casesQueryKeys.detail(submissionId), "phase-history"],
			});
			queryClient.invalidateQueries({
				queryKey: ["cases"],
			});
			toast.success("Phase advanced successfully!");
			logger.info("Phase advanced via hook", { submissionId });
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

// Hook for sending case back to earlier phase
export const useSendBack = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			submissionId,
			targetPhase,
			reason,
		}: {
			submissionId: number;
			targetPhase: CasePhase;
			reason: string;
		}) => {
			logger.info("Sending case back", {
				submissionId,
				targetPhase,
				reason,
			});
			return sendBack(submissionId, {
				target_phase: targetPhase,
				reason,
			});
		},
		onSuccess: async (response, { submissionId }) => {
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.detail(submissionId),
			});
			queryClient.invalidateQueries({
				queryKey: casesQueryKeys.lists(),
			});
			queryClient.invalidateQueries({
				queryKey: [...casesQueryKeys.detail(submissionId), "phase-history"],
			});
			queryClient.invalidateQueries({
				queryKey: ["cases"],
			});
			toast.success(response.message);
			logger.info("Case sent back via hook", {
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

// Hook for searching cases (alias for useCases with search focus)
export const useCaseSearch = (params: CasesSearchParams) => {
	return useCases(params);
};
