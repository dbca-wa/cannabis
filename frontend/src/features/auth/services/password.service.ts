import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	PasswordValidationRequest,
	PasswordValidationResponse,
	PasswordUpdateRequest,
	PasswordUpdateResponse,
	ForgotPasswordRequest,
	ForgotPasswordResponse,
} from "@/shared/types/backend-api.types";

/**
 * Validate password strength against backend rules.
 */
export const validatePassword = async (
	password: string
): Promise<PasswordValidationResponse> => {
	return apiClient.post<PasswordValidationResponse>(
		ENDPOINTS.AUTH.VALIDATE_PASSWORD,
		{ password } as PasswordValidationRequest
	);
};

/**
 * Update the current user's password.
 */
export const updatePassword = async (
	data: PasswordUpdateRequest
): Promise<PasswordUpdateResponse> => {
	return apiClient.post<PasswordUpdateResponse>(
		ENDPOINTS.AUTH.UPDATE_PASSWORD,
		data
	);
};

/**
 * Request a password reset email.
 */
export const forgotPassword = async (
	email: string
): Promise<ForgotPasswordResponse> => {
	return apiClient.post<ForgotPasswordResponse>(
		ENDPOINTS.AUTH.FORGOT_PASSWORD,
		{ email } as ForgotPasswordRequest
	);
};
