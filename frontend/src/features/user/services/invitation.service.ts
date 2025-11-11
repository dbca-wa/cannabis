import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { generateRequestId } from "@/shared/utils/uuid";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";
import { errorHandlingService } from "@/shared/services/errorHandling.service";
import type {
	ServiceResult,
	InviteUserRequest,
	InviteRecord,
	PaginatedResponse,
	ExternalUserSearchResponse,
} from "@/shared/types/backend-api.types";
import type { InvitationSearchParams } from "../types/users.types";

class InvitationService {
	private generateRequestId(): string {
		return generateRequestId("invitation");
	}

	async sendInvitation(inviteData: InviteUserRequest): Promise<ServiceResult<InviteRecord>> {
		const requestId = this.generateRequestId();
		logger.info("Sending user invitation", {
			email: inviteData.external_user_data?.email,
			role: inviteData.role,
			requestId,
		});

		try {
			const response = await apiClient.post<InviteRecord>(
				ENDPOINTS.USERS.INVITE,
				inviteData
			);

			logger.info("User invitation sent successfully", {
				inviteId: response.id,
				email: inviteData.external_user_data?.email,
				expiresAt: response.expires_at,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const enhancedError = errorHandlingService.handleError(error, {
				action: "send_invitation",
				email: inviteData.external_user_data?.email,
				role: inviteData.role,
				requestId
			}, {
				showToast: false // Let the component handle the toast
			});

			return {
				data: {} as InviteRecord,
				success: false,
				error: enhancedError.userFriendlyMessage,
			};
		}
	}

	async getInvitations(params: InvitationSearchParams = {}): Promise<ServiceResult<PaginatedResponse<InviteRecord>>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching invitations list", { params, requestId });

		try {
			const cleanParams = buildQueryParams({
				email: params.email?.trim(),
				is_valid: params.is_valid,
				is_used: params.is_used,
				invited_by: params.invited_by,
				role: params.role,
				limit: params.limit,
				offset: params.offset,
				ordering: params.ordering,
			});

			const response = await apiClient.get<PaginatedResponse<InviteRecord>>(
				ENDPOINTS.USERS.INVITATIONS,
				{ params: cleanParams }
			);

			logger.info("Invitations fetched successfully", {
				count: response.results?.length || 0,
				totalCount: response.count,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch invitations", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as PaginatedResponse<InviteRecord>,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async cancelInvitation(inviteId: number): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Cancelling invitation", { inviteId, requestId });

		try {
			await apiClient.delete(ENDPOINTS.USERS.CANCEL_INVITATION(inviteId));

			logger.info("Invitation cancelled successfully", {
				inviteId,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to cancel invitation", {
				inviteId,
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

	async searchExternalUsers(query: string): Promise<ServiceResult<ExternalUserSearchResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Searching external users", { query, requestId });

		try {
			const response = await apiClient.get<ExternalUserSearchResponse>(
				ENDPOINTS.USERS.EXTERNAL_SEARCH,
				{ params: { search: query.trim() } }
			);

			logger.info("External user search completed", {
				count: response.results?.length || 0,
				query,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("External user search failed", {
				query,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: { results: [] },
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async resendInvitation(inviteId: number): Promise<ServiceResult<InviteRecord>> {
		const requestId = this.generateRequestId();
		logger.info("Resending invitation", { inviteId, requestId });

		try {
			const response = await apiClient.post<InviteRecord>(
				`${ENDPOINTS.USERS.INVITATIONS}${inviteId}/resend/`
			);

			logger.info("Invitation resent successfully", {
				inviteId,
				newExpiresAt: response.expires_at,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to resend invitation", {
				inviteId,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as InviteRecord,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * Check if an invitation is still valid (not expired and not used)
	 */
	static isInvitationValid(invite: InviteRecord): boolean {
		if (!invite.is_valid || invite.is_used) {
			return false;
		}

		const expiresAt = new Date(invite.expires_at);
		const now = new Date();
		
		return expiresAt > now;
	}

	/**
	 * Get human-readable status for an invitation
	 */
	static getInvitationStatus(invite: InviteRecord): {
		status: "valid" | "expired" | "used" | "cancelled";
		label: string;
		colorClass: string;
	} {
		if (invite.is_used) {
			return {
				status: "used",
				label: "Used",
				colorClass: "text-green-600 bg-green-50",
			};
		}

		if (!invite.is_valid) {
			return {
				status: "cancelled",
				label: "Cancelled",
				colorClass: "text-red-600 bg-red-50",
			};
		}

		const expiresAt = new Date(invite.expires_at);
		const now = new Date();

		if (expiresAt <= now) {
			return {
				status: "expired",
				label: "Expired",
				colorClass: "text-orange-600 bg-orange-50",
			};
		}

		return {
			status: "valid",
			label: "Valid",
			colorClass: "text-blue-600 bg-blue-50",
		};
	}

	/**
	 * Format time remaining for valid invitations
	 */
	static getTimeRemaining(invite: InviteRecord): string | null {
		if (!this.isInvitationValid(invite)) {
			return null;
		}

		const expiresAt = new Date(invite.expires_at);
		const now = new Date();
		const diffMs = expiresAt.getTime() - now.getTime();

		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours}h ${minutes}m remaining`;
		} else if (minutes > 0) {
			return `${minutes}m remaining`;
		} else {
			return "Expires soon";
		}
	}
}

// Export singleton instance
export const invitationService = new InvitationService();

// Export class for static method access
export { InvitationService };