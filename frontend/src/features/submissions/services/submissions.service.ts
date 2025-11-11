import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient } from "@/shared/services/api";
import { type ServiceResult } from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";
import {
	type Submission,
	type SubmissionTiny,
	type PaginatedSubmissionsResponse,
	type SubmissionsSearchParams,
	type SubmissionCreateRequest,
	type SubmissionUpdateRequest,
	type WorkflowActionRequest,
	type WorkflowActionResponse,
	type SendBackRequest,
	type SendBackResponse,
	type PhaseHistoryEntry,
} from "@/shared/types/backend-api.types";

class SubmissionsService {
	private static readonly BASE_URL = "/submissions";

	private generateRequestId(): string {
		return `submissions_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	/**
	 * Get paginated list of submissions with search and filtering
	 */
	async getSubmissions(
		params: SubmissionsSearchParams = {}
	): Promise<ServiceResult<PaginatedSubmissionsResponse>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching submissions list", { params, requestId });

		try {
			const cleanParams = buildQueryParams({
				search: params.search,
				phase: params.phase,
				botanist: params.botanist,
				finance: params.finance,
				cannabis_only: params.cannabis_only,
				draft_only: params.draft_only,
				date_from: params.date_from,
				date_to: params.date_to,
				full: params.full,
				limit: params.limit,
				offset: params.offset,
				ordering: params.ordering,
			});

			logger.debug("Parameters after buildQueryParams", {
				originalParams: params,
				cleanedParams: cleanParams,
				requestId,
			});

			const searchParams = new URLSearchParams();
			Object.entries(cleanParams).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					value.forEach((v) => searchParams.append(key, String(v)));
				} else {
					searchParams.append(key, String(value));
				}
			});

			const queryString = searchParams.toString();
			const endpoint = queryString
				? `${SubmissionsService.BASE_URL}/?${queryString}`
				: `${SubmissionsService.BASE_URL}/`;

			logger.debug("Making submissions request", {
				endpoint,
				queryString,
				params,
				requestId,
			});

			const response = await apiClient.get<PaginatedSubmissionsResponse>(
				endpoint
			);

			logger.info("Submissions fetched successfully", {
				count: response.results?.length || 0,
				totalCount: response.count,
				hasNext: !!response.next,
				hasPrevious: !!response.previous,
				requestId,
				data: response.results,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch submissions", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as PaginatedSubmissionsResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Search submissions (alias for getSubmissions with search focus)
	 */
	async searchSubmissions(
		params: SubmissionsSearchParams
	): Promise<ServiceResult<PaginatedSubmissionsResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Searching submissions", { params, requestId });

		// Use the same getSubmissions method but with search focus
		return this.getSubmissions(params);
	}

	/**
	 * Get submission by ID with full details
	 */
	async getSubmissionById(id: number): Promise<ServiceResult<Submission>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching submission by ID", {
			submissionId: id,
			requestId,
		});

		try {
			const response = await apiClient.get<Submission>(
				`${SubmissionsService.BASE_URL}/${id}/`
			);

			logger.info("Submission fetched successfully", {
				submissionId: id,
				caseNumber: response.case_number,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch submission", {
				submissionId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as Submission,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Create new submission
	 */
	async createSubmission(
		data: SubmissionCreateRequest
	): Promise<ServiceResult<Submission>> {
		const requestId = this.generateRequestId();

		logger.info("Creating new submission", { data, requestId });

		try {
			const response = await apiClient.post<Submission>(
				`${SubmissionsService.BASE_URL}/`,
				data
			);

			logger.info("Submission created successfully", {
				submissionId: response.id,
				caseNumber: response.case_number,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to create submission", {
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as Submission,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Update existing submission
	 */
	async updateSubmission(
		id: number,
		data: SubmissionUpdateRequest
	): Promise<ServiceResult<Submission>> {
		const requestId = this.generateRequestId();

		logger.info("Updating submission", {
			submissionId: id,
			data,
			requestId,
		});

		try {
			const response = await apiClient.patch<Submission>(
				`${SubmissionsService.BASE_URL}/${id}/`,
				data
			);

			logger.info("Submission updated successfully", {
				submissionId: id,
				caseNumber: response.case_number,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to update submission", {
				submissionId: id,
				data,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as Submission,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Delete submission
	 */
	async deleteSubmission(id: number): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();

		logger.info("Deleting submission", { submissionId: id, requestId });

		try {
			await apiClient.delete(`${SubmissionsService.BASE_URL}/${id}/`);

			logger.info("Submission deleted successfully", {
				submissionId: id,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to delete submission", {
				submissionId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Execute workflow action on submission
	 */
	async executeWorkflowAction(
		id: number,
		action: WorkflowActionRequest
	): Promise<ServiceResult<WorkflowActionResponse>> {
		const requestId = this.generateRequestId();

		logger.info("Executing workflow action", {
			submissionId: id,
			action,
			requestId,
		});

		try {
			const response = await apiClient.post<WorkflowActionResponse>(
				`${SubmissionsService.BASE_URL}/${id}/workflow/`,
				action
			);

			logger.info("Workflow action executed successfully", {
				submissionId: id,
				action: action.action,
				response,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to execute workflow action", {
				submissionId: id,
				action,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as WorkflowActionResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Send submission back to an earlier phase
	 */
	async sendBack(
		id: number,
		request: SendBackRequest
	): Promise<ServiceResult<SendBackResponse>> {
		const requestId = this.generateRequestId();

		logger.info("Sending submission back", {
			submissionId: id,
			targetPhase: request.target_phase,
			reason: request.reason,
			requestId,
		});

		try {
			const response = await apiClient.post<SendBackResponse>(
				`${SubmissionsService.BASE_URL}/${id}/send-back/`,
				request
			);

			logger.info("Submission sent back successfully", {
				submissionId: id,
				newPhase: response.new_phase,
				sentBackBy: response.sent_back_by,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to send submission back", {
				submissionId: id,
				request,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as SendBackResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Get phase history for a submission
	 */
	async getPhaseHistory(
		id: number,
		params: { action?: string; user?: number; ordering?: string } = {}
	): Promise<ServiceResult<PhaseHistoryEntry[]>> {
		const requestId = this.generateRequestId();

		logger.info("Fetching phase history", {
			submissionId: id,
			params,
			requestId,
		});

		try {
			const cleanParams = buildQueryParams({
				action: params.action,
				user: params.user,
				ordering: params.ordering,
			});

			const searchParams = new URLSearchParams();
			Object.entries(cleanParams).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					value.forEach((v) => searchParams.append(key, String(v)));
				} else {
					searchParams.append(key, String(value));
				}
			});

			const queryString = searchParams.toString();
			const endpoint = queryString
				? `${SubmissionsService.BASE_URL}/${id}/phase-history/?${queryString}`
				: `${SubmissionsService.BASE_URL}/${id}/phase-history/`;

			const response = await apiClient.get<{
				count: number;
				results: PhaseHistoryEntry[];
			}>(endpoint);

			logger.info("Phase history fetched successfully", {
				submissionId: id,
				historyCount: response.results.length,
				requestId,
			});

			return {
				data: response.results,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch phase history", {
				submissionId: id,
				params,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: [],
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Check if submission can be deleted (no associated certificates/invoices)
	 */
	static canDeleteSubmission(submission: Submission): boolean {
		// Don't allow deletion if submission has certificates or invoices
		return (
			submission.certificates.length === 0 &&
			submission.invoices.length === 0
		);
	}

	/**
	 * Get deletion warning message for submission
	 */
	static getDeletionWarningMessage(submission: Submission): string {
		if (submission.certificates.length > 0) {
			return `Cannot delete submission ${submission.case_number} because it has ${submission.certificates.length} associated certificate(s).`;
		}
		if (submission.invoices.length > 0) {
			return `Cannot delete submission ${submission.case_number} because it has ${submission.invoices.length} associated invoice(s).`;
		}
		return "";
	}

	/**
	 * Format submission display name for UI
	 */
	static formatSubmissionDisplayName(
		submission: Submission | SubmissionTiny
	): string {
		return `${submission.case_number} - ${submission.phase_display}`;
	}

	/**
	 * Get phase color class for UI display (NEW 6-PHASE WORKFLOW)
	 */
	static getPhaseColorClass(phase: string, isDark: boolean = false): string {
		const colorMap: Record<string, { light: string; dark: string }> = {
			data_entry: { light: "text-gray-600", dark: "text-gray-400" },
			finance_approval: {
				light: "text-cyan-600",
				dark: "text-cyan-400",
			},
			botanist_review: {
				light: "text-green-600",
				dark: "text-green-400",
			},
			documents: {
				light: "text-purple-600",
				dark: "text-purple-400",
			},
			send_emails: {
				light: "text-orange-600",
				dark: "text-orange-400",
			},
			complete: { light: "text-emerald-600", dark: "text-emerald-400" },
		};

		const colors = colorMap[phase];
		if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

		return isDark ? colors.dark : colors.light;
	}

	/**
	 * Get phase background color class for badges (NEW 6-PHASE WORKFLOW)
	 */
	static getPhaseBadgeClass(phase: string): string {
		const badgeMap: Record<string, string> = {
			data_entry: "bg-gray-100 text-gray-800",
			finance_approval: "bg-cyan-100 text-cyan-800",
			botanist_review: "bg-green-100 text-green-800",
			documents: "bg-purple-100 text-purple-800",
			send_emails: "bg-orange-100 text-orange-800",
			complete: "bg-emerald-100 text-emerald-800",
		};

		return badgeMap[phase] || "bg-gray-100 text-gray-800";
	}

	/**
	 * Get phase hex color for progress indicators (NEW 6-PHASE WORKFLOW)
	 */
	static getPhaseColor(phase: string): string {
		const colorMap: Record<string, string> = {
			data_entry: "#6c757d", // Gray
			finance_approval: "#17a2b8", // Cyan
			botanist_review: "#28a745", // Green
			documents: "#6f42c1", // Purple
			send_emails: "#fd7e14", // Orange
			complete: "#28a745", // Green
		};

		return colorMap[phase] || "#6c757d";
	}

	/**
	 * Get phase display name (NEW 6-PHASE WORKFLOW)
	 */
	static getPhaseDisplay(phase: string): string {
		const displayMap: Record<string, string> = {
			data_entry: "Data Entry",
			finance_approval: "Finance Approval",
			botanist_review: "Botanist Review",
			documents: "Documents",
			send_emails: "Send Emails",
			complete: "Complete",
		};

		return displayMap[phase] || phase;
	}
}

// Export both the class and an instance
export const submissionsService = new SubmissionsService();
export { SubmissionsService };
