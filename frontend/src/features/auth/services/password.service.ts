import { logger } from "@/shared/services/logger.service";
import { generateRequestId } from "@/shared/utils/uuid";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { errorHandlingService } from "@/shared/services/errorHandling.service";
import type {
	ServiceResult,
	PasswordValidationRequest,
	PasswordValidationResponse,
	PasswordUpdateRequest,
	PasswordUpdateResponse,
	ForgotPasswordRequest,
	ForgotPasswordResponse,
} from "@/shared/types/backend-api.types";

class PasswordService {
	private generateRequestId(): string {
		return generateRequestId("password");
	}

	async validatePassword(password: string): Promise<ServiceResult<PasswordValidationResponse>> {
		const requestId = this.generateRequestId();
		logger.debug("Validating password strength", { requestId });

		try {
			const response = await apiClient.post<PasswordValidationResponse>(
				ENDPOINTS.AUTH.VALIDATE_PASSWORD,
				{ password } as PasswordValidationRequest
			);

			logger.debug("Password validation completed", {
				isValid: response.is_valid,
				errorCount: response.errors?.length || 0,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const enhancedError = errorHandlingService.handleError(error, {
				action: "password_validation",
				requestId
			}, {
				showToast: false // Don't show toast for validation errors
			});

			return {
				data: { is_valid: false, errors: ["Validation service unavailable"] },
				success: false,
				error: enhancedError.userFriendlyMessage,
			};
		}
	}

	async updatePassword(data: PasswordUpdateRequest): Promise<ServiceResult<PasswordUpdateResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Attempting password update", { requestId });

		try {
			const response = await apiClient.post<PasswordUpdateResponse>(
				ENDPOINTS.AUTH.UPDATE_PASSWORD,
				data
			);

			logger.info("Password updated successfully", {
				passwordChangedAt: response.password_changed_at,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const enhancedError = errorHandlingService.handleError(error, {
				action: "password_update",
				requestId
			}, {
				showToast: false // Let the component handle the toast
			});

			return {
				data: {} as PasswordUpdateResponse,
				success: false,
				error: enhancedError.userFriendlyMessage,
			};
		}
	}

	async forgotPassword(email: string): Promise<ServiceResult<ForgotPasswordResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Attempting forgot password request", {
			email,
			requestId,
		});

		try {
			const response = await apiClient.post<ForgotPasswordResponse>(
				ENDPOINTS.AUTH.FORGOT_PASSWORD,
				{ email } as ForgotPasswordRequest
			);

			logger.info("Forgot password request successful", {
				email,
				emailSent: response.email_sent,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const enhancedError = errorHandlingService.handleError(error, {
				action: "forgot_password",
				email,
				requestId
			}, {
				showToast: false // Let the component handle the toast
			});

			return {
				data: {} as ForgotPasswordResponse,
				success: false,
				error: enhancedError.userFriendlyMessage,
			};
		}
	}


}

// Export singleton instance
export const passwordService = new PasswordService();