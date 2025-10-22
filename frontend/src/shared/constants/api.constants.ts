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

// Password validation constants
export const PASSWORD_REQUIREMENTS = {
	MIN_LENGTH: 10,
	REQUIRED_PATTERNS: {
		LETTER: /[A-Za-z]/,
		NUMBER: /\d/,
		SPECIAL_CHAR: /[!@#$%^&*(),.?":{}|<>]/,
	},
} as const;

// Invitation constants
export const INVITATION = {
	EXPIRY_HOURS: 24,
	TOKEN_LENGTH: 32,
} as const;

// Error messages for invitation system
export const INVITATION_ERRORS = {
	INVALID_TOKEN: "Invalid or expired invitation link",
	ALREADY_USED: "This invitation has already been used",
	EXPIRED: "This invitation has expired",
	USER_EXISTS: "A user with this email already exists",
	EMAIL_SEND_FAILED: "Failed to send invitation email",
} as const;

// Error messages for password management
export const PASSWORD_ERRORS = {
	WEAK_PASSWORD: "Password does not meet security requirements",
	CURRENT_PASSWORD_INCORRECT: "Current password is incorrect",
	PASSWORDS_DONT_MATCH: "Passwords do not match",
	VALIDATION_FAILED: "Password validation failed",
} as const;
