/**
 * Basic route constants
 * Note: Main route configuration is handled in app/config/routes.config.tsx
 * These are minimal constants that might be referenced across features
 */

// Auth routes (commonly referenced)
export const AUTH_ROUTES = {
	LOGIN: "/login",
	LOGOUT: "/logout",
} as const;

// Error page routes
export const ERROR_ROUTES = {
	NOT_FOUND: "/404",
	UNAUTHORIZED: "/401",
	FORBIDDEN: "/403",
	SERVER_ERROR: "/500",
} as const;

// Route helper functions
export const ROUTE_HELPERS = {
	isAuthRoute: (path: string) =>
		Object.values(AUTH_ROUTES).includes(path as any),
	isErrorRoute: (path: string) =>
		Object.values(ERROR_ROUTES).includes(path as any),
} as const;
