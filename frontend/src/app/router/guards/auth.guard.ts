import { rootStore } from "@/app/stores/root.store";
import { type LoaderFunctionArgs, redirect } from "react-router";
import { logger } from "@/shared/services/logger.service";
import {
	hasValidTokens,
	getCurrentUser,
	refreshToken,
} from "@/features/auth/services/auth.service";
import { storage } from "@/shared/services/storage.service";

/**
 * Helper function to check authentication status.
 * Attempts a proactive token refresh if the access token is expired
 * but a refresh token still exists.
 */
const checkAuthStatus = async () => {
	let isAuthenticated = false;
	let user = null;

	try {
		if (hasValidTokens()) {
			// If access token is expired, try refreshing before making API calls
			const accessToken = storage.getAccessToken();
			if (accessToken && storage.isTokenExpired(accessToken)) {
				logger.debug(
					"[AuthGuard] Access token expired, attempting proactive refresh"
				);
				try {
					await refreshToken();
					logger.debug("[AuthGuard] Proactive token refresh succeeded");
				} catch {
					logger.debug("[AuthGuard] Proactive token refresh failed");
					return { isAuthenticated: false, user: null };
				}
			}

			const fetchedUser = await getCurrentUser();
			if (fetchedUser) {
				isAuthenticated = true;
				user = fetchedUser;
				logger.debug("[AuthGuard] User authenticated", {
					userId: fetchedUser.id,
					email: fetchedUser.email,
				});
			} else {
				logger.debug("[AuthGuard] Auth check failed - no user data");
			}
		} else {
			// Tokens missing — check if we have a refresh token we can use
			const refreshTokenValue = storage.getRefreshToken();
			if (refreshTokenValue && !storage.isTokenExpired(refreshTokenValue)) {
				logger.debug(
					"[AuthGuard] Access token missing but refresh token available, attempting refresh"
				);
				try {
					await refreshToken();
					const fetchedUser = await getCurrentUser();
					if (fetchedUser) {
						isAuthenticated = true;
						user = fetchedUser;
						logger.debug("[AuthGuard] User authenticated after token refresh", {
							userId: fetchedUser.id,
							email: fetchedUser.email,
						});
					}
				} catch {
					logger.debug("[AuthGuard] Token refresh attempt failed");
				}
			} else {
				logger.debug("[AuthGuard] No valid tokens found");
			}
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
		// Initialise stores (client state only)
		await rootStore.initialise();
	} catch (error) {
		// Don't let store initialisation failures block the app
		logger.error(
			"[RootAuthGuard] Store initialisation failed, but continuing with auth check",
			{ error }
		);
	}

	// For auth routes, handle them first to avoid unnecessary auth checks
	if (pathname.startsWith("/auth/")) {
		// Special caseObj: password-update requires authentication
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

		// Special caseObj: invitation activation doesn't require authentication (public route)
		if (
			pathname.startsWith("/auth/activate-invite/") ||
			pathname === "/auth/invite-error"
		) {
			logger.debug(
				"[RootAuthGuard] Invitation activation/error is public, allowing access"
			);
			return null;
		}

		// Special caseObj: password reset code entry and success pages are public
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

	// Users without an app role (and not admin) may only access the dashboard.
	const hasAppAccess = !!(
		user?.is_superuser ||
		user?.is_staff ||
		user?.role === "botanist" ||
		user?.role === "finance"
	);
	if (!hasAppAccess && pathname !== "/") {
		logger.warn(
			"[RootAuthGuard] Roleless user blocked from non-dashboard route",
			{ userId: user?.id, pathname }
		);
		return redirect("/");
	}

	// Check admin route protection - only superusers can access admin routes
	if (pathname.startsWith("/admin")) {
		const isAdmin = user?.is_superuser;
		if (!isAdmin) {
			logger.warn(
				"[RootAuthGuard] Non-admin user attempted to access admin route",
				{
					userId: user?.id,
					isStaff: user?.is_staff,
					isSuperuser: user?.is_superuser,
					pathname,
				}
			);
			return redirect("/"); // Redirect to home page
		}
		logger.debug("[RootAuthGuard] Admin user accessing admin route");
	}

	logger.debug("[RootAuthGuard] User authenticated, allowing access");
	return null;
};

export { rootAuthGuard };
