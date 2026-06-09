// API configuration - all in one place
//
// In development the API runs on a different port, so we use the dev env var.
// In production/staging the frontend and backend share the same domain via
// ingress routing (/api → backend, / → frontend), so we derive the API URL
// from the current origin at runtime. This means one built image works in both
// staging (cannabis-test.dbca.wa.gov.au) and production (cannabis.dbca.wa.gov.au)
// without rebuilding.

const getProductionApiUrl = (): string => {
	if (typeof window !== "undefined") {
		return `${window.location.origin}/api/v1/`;
	}
	// Non-browser context (tests, SSR) — no API URL available
	return "";
};

export const API_CONFIG = {
	// Base URL configuration
	BASE_URL: import.meta.env.DEV
		? import.meta.env.VITE_DEV_BACKEND_API_URL || "http://127.0.0.1:8000/api/v1"
		: getProductionApiUrl(),

	// Request configuration
	TIMEOUT: 30000,
} as const;
