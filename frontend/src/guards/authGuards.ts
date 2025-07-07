import { LoaderFunctionArgs, redirect } from "react-router";
import { rootStore } from "@/stores/rootStore";

// Root authentication guard
const rootAuthGuard = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	const pathname = url.pathname;
	const authStore = rootStore.authStore;

	console.log("[RootAuthGuard] Checking path:", pathname);
	console.log("[RootAuthGuard] Auth loading state:", authStore.isLoading);

	// Wait for auth check to complete if still loading
	while (authStore.isLoading) {
		console.log("[RootAuthGuard] Waiting for auth check to complete...");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}

	console.log(
		"[RootAuthGuard] Auth state - isAuthenticated:",
		authStore.isAuthenticated
	);

	// In production, auth routes don't exist (there is no need to register or login as handled by SSO), so this check is only for development
	if (
		process.env.NODE_ENV === "development" &&
		pathname.startsWith("/auth/")
	) {
		console.log("[RootAuthGuard] Checking auth route access");
		// Redirect authenticated users away from auth pages
		if (authStore.isAuthenticated) {
			console.log(
				"[RootAuthGuard] User authenticated, redirecting from auth page to home"
			);
			return redirect("/");
		}
		console.log(
			"[RootAuthGuard] User not authenticated, allowing access to auth pages"
		);
		return null;
	}

	// For all other routes, require authentication
	if (!authStore.isAuthenticated) {
		console.log(
			"[RootAuthGuard] User not authenticated, redirecting to login"
		);
		return redirect("/auth/login");
	}

	console.log("[RootAuthGuard] User authenticated, allowing access");
	return null;
};

// Admin-specific guard (can be used in addition to rootAuthGuard)
const adminGuard = async () => {
	const authStore = rootStore.authStore;

	// Wait for auth check to complete if still loading
	while (authStore.isLoading) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}

	if (!authStore.isAuthenticated) {
		return redirect("/auth/login");
	}

	if (!authStore.isAdmin) {
		return redirect("/");
	}

	return null;
};

export { rootAuthGuard, adminGuard };
