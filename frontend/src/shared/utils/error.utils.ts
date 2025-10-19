import { type ApiError } from "@/shared/services/api";

// Django-specific error response types
interface DjangoFieldError {
	[fieldName: string]: string | string[];
}

interface DjangoNonFieldError {
	non_field_errors: string[];
}

interface DjangoDetailError {
	detail: string;
}

interface DjangoMessageError {
	message: string;
}

// Union type for all Django error formats
type DjangoErrorResponse =
	| DjangoFieldError
	| DjangoNonFieldError
	| DjangoDetailError
	| DjangoMessageError
	| string;

// Axios error response type
interface AxiosErrorResponse {
	response?: {
		data?: DjangoErrorResponse;
		status?: number;
	};
	message?: string;
}

// Type guard to check if error is an ApiError from ApiClientService
export function isApiError(error: unknown): error is ApiError {
	return (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		"code" in error &&
		"status" in error &&
		"timestamp" in error
	);
}

// Type guard to check if error is a standard Error object
export function isError(error: unknown): error is Error {
	return error instanceof Error;
}

// Type guard for Axios error with response
export function isAxiosErrorResponse(
	error: unknown
): error is AxiosErrorResponse {
	return typeof error === "object" && error !== null && "response" in error;
}

// Django error type guards
export function isDjangoNonFieldErrors(
	errorData: unknown
): errorData is DjangoNonFieldError {
	return (
		typeof errorData === "object" &&
		errorData !== null &&
		"non_field_errors" in errorData &&
		Array.isArray((errorData as DjangoNonFieldError).non_field_errors)
	);
}

export function isDjangoDetailError(
	errorData: unknown
): errorData is DjangoDetailError {
	return (
		typeof errorData === "object" &&
		errorData !== null &&
		"detail" in errorData &&
		typeof (errorData as DjangoDetailError).detail === "string"
	);
}

export function isDjangoMessageError(
	errorData: unknown
): errorData is DjangoMessageError {
	return (
		typeof errorData === "object" &&
		errorData !== null &&
		"message" in errorData &&
		typeof (errorData as DjangoMessageError).message === "string"
	);
}

export function isStringError(errorData: unknown): errorData is string {
	return typeof errorData === "string";
}

export function isDjangoFieldErrors(
	errorData: unknown
): errorData is DjangoFieldError {
	return (
		typeof errorData === "object" &&
		errorData !== null &&
		!isDjangoNonFieldErrors(errorData) &&
		!isDjangoDetailError(errorData) &&
		!isDjangoMessageError(errorData) &&
		!isStringError(errorData)
	);
}

/**
 * Enhanced error message extraction that handles Django, ApiClient, and generic errors
 * **Handles all error formats in one place**
 */
export function getErrorMessage(error: unknown): string {
	// 1. Handle ApiError from ApiClientService
	if (isApiError(error)) {
		return error.message;
	}

	// 2. Handle Axios errors with Django response data
	if (isAxiosErrorResponse(error)) {
		return extractDjangoErrorMessage(error);
	}

	// 3. Handle standard JavaScript errors
	if (isError(error)) {
		return error.message;
	}

	// 4. Handle string errors
	if (typeof error === "string") {
		return error;
	}

	// 5. Fallback for unknown error types
	return "An unknown error occurred";
}

/**
 * Extracts error message from Django API error responses
 */
export function extractDjangoErrorMessage(
	error: AxiosErrorResponse,
	fallbackMessage: string = "An error occurred"
): string {
	// Check if we have response data
	if (!error?.response?.data) {
		return error?.message || fallbackMessage;
	}

	const errorData = error.response.data;

	// Handle different Django error formats in priority order

	// 1. Non-field errors (validation errors that span multiple fields)
	if (isDjangoNonFieldErrors(errorData)) {
		return errorData.non_field_errors[0] || fallbackMessage;
	}

	// 2. Detail errors (simple message from Django)
	if (isDjangoDetailError(errorData)) {
		return errorData.detail;
	}

	// 3. Message errors (custom message)
	if (isDjangoMessageError(errorData)) {
		return errorData.message;
	}

	// 4. String errors (sometimes Django returns just a string)
	if (isStringError(errorData)) {
		return errorData;
	}

	// 5. Field-specific errors (form validation errors)
	if (isDjangoFieldErrors(errorData)) {
		const fieldErrors = extractFieldErrors(errorData);
		if (fieldErrors.length > 0) {
			return fieldErrors.join(", ");
		}
	}

	// 6. Fallback to axios error message
	return error?.message || fallbackMessage;
}

/**
 * Extracts field-specific error messages from Django field errors
 */
export function extractFieldErrors(fieldErrors: DjangoFieldError): string[] {
	return Object.entries(fieldErrors)
		.filter(([_, value]) => value !== undefined && value !== null)
		.map(([fieldName, errors]) => {
			// Handle both string and array errors
			const errorArray = Array.isArray(errors) ? errors : [errors];
			const firstError = errorArray[0];

			// Format field name nicely (convert snake_case to Title Case)
			const formattedFieldName = fieldName
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");

			return `${formattedFieldName}: ${firstError}`;
		});
}

/**
 * Get all error messages from any error type
 */
export function getAllErrorMessages(error: unknown): string[] {
	// Handle ApiError
	if (isApiError(error)) {
		return [error.message];
	}

	// Handle Axios errors with Django data
	if (isAxiosErrorResponse(error)) {
		return getAllDjangoErrorMessages(error);
	}

	// Handle standard errors
	if (isError(error)) {
		return [error.message];
	}

	// Handle string errors
	if (typeof error === "string") {
		return [error];
	}

	return ["An unknown error occurred"];
}

/**
 * Get all error messages from a Django error response
 */
export function getAllDjangoErrorMessages(error: AxiosErrorResponse): string[] {
	if (!error?.response?.data) {
		return [error?.message || "An error occurred"];
	}

	const errorData = error.response.data;
	const messages: string[] = [];

	if (isDjangoNonFieldErrors(errorData)) {
		messages.push(...errorData.non_field_errors);
	}

	if (isDjangoDetailError(errorData)) {
		messages.push(errorData.detail);
	}

	if (isDjangoMessageError(errorData)) {
		messages.push(errorData.message);
	}

	if (isStringError(errorData)) {
		messages.push(errorData);
	}

	if (isDjangoFieldErrors(errorData)) {
		const fieldErrors = extractFieldErrors(errorData);
		messages.push(...fieldErrors);
	}

	return messages.length > 0
		? messages
		: [error?.message || "An error occurred"];
}

/**
 * Safely extract error code from unknown error
 */
export function getErrorCode(error: unknown): string {
	if (isApiError(error)) {
		return error.message; // Use message instead of code since ApiError doesn't have code
	}

	if (isError(error)) {
		return error.name || "Error";
	}

	if (isAxiosErrorResponse(error)) {
		return `HTTP_${error.response?.status || 0}`;
	}

	return "UNKNOWN_ERROR";
}

/**
 * Convert unknown error to a standardized format
 * Enhanced with Django error support
 */
export function normalizeError(error: unknown): {
	message: string;
	code: string;
	originalError: unknown;
	allMessages?: string[];
} {
	const message = getErrorMessage(error);
	const code = getErrorCode(error);

	// For Django errors, also include all messages
	const allMessages = isAxiosErrorResponse(error)
		? getAllDjangoErrorMessages(error)
		: undefined;

	return {
		message,
		code,
		originalError: error,
		allMessages,
	};
}

/**
 * Utility for form validation - extracts field-specific errors
 * Useful for highlighting specific form fields
 */
export function getFieldErrors(error: unknown): Record<string, string[]> {
	if (!isAxiosErrorResponse(error) || !error.response?.data) {
		return {};
	}

	const errorData = error.response.data;

	if (!isDjangoFieldErrors(errorData)) {
		return {};
	}

	const fieldErrors: Record<string, string[]> = {};

	Object.entries(errorData).forEach(([fieldName, errors]) => {
		if (errors !== undefined && errors !== null) {
			fieldErrors[fieldName] = Array.isArray(errors) ? errors : [errors];
		}
	});

	return fieldErrors;
}
