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
			if (result.success && result.data) {
				isAuthenticated = true;
				user = result.data;
				logger.debug("[AuthGuard] User authenticated", { 
					userId: user.id, 
					email: user.email 
				});
			} else {
				logger.debug("[AuthGuard] Auth check failed - no user data", { 
					error: result.error 
				});
			}
		} else {
			logger.debug("[AuthGuard] No valid tokens found");
		}
	} catch (error) {
		logger.debug("[AuthGuard] Auth check failed with exception", { error });
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

	// For auth routes, handle them first to avoid unnecessary auth checks
	if (pathname.startsWith("/auth/")) {
		// Special case: password-update requires authentication
		if (pathname === "/auth/password-update") {
			const { isAuthenticated } = await checkAuthStatus();
			if (!isAuthenticated) {
				logger.debug(
					"[RootAuthGuard] Password update requires authentication, redirecting to login"
				);
				return redirect("/auth/login");
			}
			logger.debug(
				"[RootAuthGuard] User authenticated, allowing access to password update"
			);
			return null;
		}
		
		// Special case: invitation activation doesn't require authentication (public route)
		if (pathname.startsWith("/auth/activate-invite/") || pathname === "/auth/invite-error") {
			logger.debug(
				"[RootAuthGuard] Invitation activation/error is public, allowing access"
			);
			return null;
		}
		
		// Special case: password reset code entry and success pages are public
		if (pathname === "/auth/reset-code" || pathname === "/auth/reset-success") {
			logger.debug(
				"[RootAuthGuard] Password reset pages are public, allowing access"
			);
			return null;
		}
		
		// For other auth routes (login), check if already authenticated
		const { isAuthenticated } = await checkAuthStatus();
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
	const { isAuthenticated, user } = await checkAuthStatus();

	logger.debug("[RootAuthGuard] Auth status for protected route", {
		isAuthenticated,
		hasUser: !!user,
		pathname,
	});

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

	// Check admin route protection - only superusers can access admin routes
	if (pathname.startsWith("/admin")) {
		const isAdmin = user?.is_superuser;
		if (!isAdmin) {
			logger.warn(
				"[RootAuthGuard] Non-admin user attempted to access admin route",
				{ userId: user?.id, isStaff: user?.is_staff, isSuperuser: user?.is_superuser, pathname }
			);
			return redirect("/"); // Redirect to home page
		}
		logger.debug("[RootAuthGuard] Admin user accessing admin route");
	}

	logger.debug("[RootAuthGuard] User authenticated, allowing access");
	return null;
};

export { rootAuthGuard };
