/**
 * Essential API constants that might be used across features
 * Most API configuration is handled by the API client service
 */

// HTTP Status Codes (commonly referenced in error handling)
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	UNPROCESSABLE_ENTITY: 422,
	INTERNAL_SERVER_ERROR: 500,
} as const;

// Common content types
export const CONTENT_TYPES = {
	JSON: "application/json",
	FORM_DATA: "multipart/form-data",
	PDF: "application/pdf",
	CSV: "text/csv",
} as const;

// Search configuration
export const SEARCH = {
	MIN_QUERY_LENGTH: 2,
	DEBOUNCE_DELAY: 300,
} as const;
