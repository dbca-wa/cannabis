// API configuration - all in one place
export const API_CONFIG = {
	// Base URL configuration
	BASE_URL: import.meta.env.DEV
		? import.meta.env.VITE_DEV_BACKEND_API_URL || "http://127.0.0.1:8000/api/v1"
		: import.meta.env.VITE_PRODUCTION_BACKEND_API_URL ||
			"https://cannabis.dbca.wa.gov.au/api/v1",

	// Request configuration
	TIMEOUT: 30000,
} as const;
