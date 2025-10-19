import { rootStore } from "@/app/stores/root.store";
import { type LoaderFunctionArgs, redirect } from "react-router";
import { logger } from "@/shared/services/logger.service";
import { authService } from "@/features/auth/services/auth.service";

/**
 * Helper function to check authentication status
 * Consolidates auth logic used by guards
 */
const checkAuthStatus = async () => {
	let isAuthenticated = false;
	let user = null;

	try {
		if (authService.hasValidTokens()) {
			const result = await authService.getCurrentUser();
			if (result.success) {
				isAuthenticated = true;
				user = result.data;
			}
		}
	} catch (error) {
		logger.debug("[AuthGuard] Auth check failed", { error });
	}

	return { isAuthenticated, user };
};

/**
 * Root authentication guard for all routes
 * Handles both auth routes and protected routes
 */
const rootAuthGuard = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	const pathname = url.pathname;

	logger.debug("[RootAuthGuard] Checking path:", { pathname });

	try {
		// Initialize stores (client state only)
		await rootStore.initialise();
	} catch (error) {
		// Don't let store initialization failures block the app
		logger.error(
			"[RootAuthGuard] Store initialisation failed, but continuing with auth check",
			{ error }
		);
	}

	// Check authentication using consolidated helper
	const { isAuthenticated, user } = await checkAuthStatus();

	logger.debug("[RootAuthGuard] Auth status", {
		isAuthenticated,
		hasUser: !!user,
		pathname,
	});

	// Handle auth routes
	if (pathname.startsWith("/auth/")) {
		if (isAuthenticated) {
			logger.debug(
				"[RootAuthGuard] User authenticated, redirecting from auth page to home"
			);
			return redirect("/");
		}
		logger.debug(
			"[RootAuthGuard] User not authenticated, allowing access to auth pages"
		);
		return null;
	}

	// For all other routes, require authentication
	if (!isAuthenticated) {
		logger.debug(
			"[RootAuthGuard] User not authenticated, redirecting to login"
		);

		// Store redirect path in AuthStore for after login
		const authStore = rootStore.authStore;
		authStore.setRedirectPath(pathname);

		return redirect("/auth/login");
	}

	logger.debug("[RootAuthGuard] User authenticated, allowing access");
	return null;
};

export { rootAuthGuard };
