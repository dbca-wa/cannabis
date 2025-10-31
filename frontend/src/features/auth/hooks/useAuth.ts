import { rootStore } from "@/app/stores/root.store";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { authService } from "../services/auth.service";
import { type LoginCredentials } from "../types/auth.types";

const AUTH_QUERY_KEY = "auth";

export const useAuth = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const authStore = rootStore.authStore;

	// Set up navigation handler for AuthStore
	useEffect(() => {
		authStore.setNavigate(navigate);
	}, [navigate, authStore]);

	// TanStack Query handles all server state
	const userQuery = useQuery({
		queryKey: [AUTH_QUERY_KEY, "user"],
		queryFn: async () => {
			const result = await authService.getCurrentUser();
			if (!result.success) {
				if (
					result.error?.includes("403") ||
					result.error?.includes("401") ||
					result.error?.includes("No valid authentication tokens found")
				) {
					// Return null for auth errors instead of throwing
					// This prevents the query from being in error state for unauthenticated users
					return null;
				}
				throw new Error(result.error || "Failed to get current user");
			}
			return result.data;
		},
		retry: (failureCount, error) => {
			// Don't retry auth errors
			if (error?.message?.includes("403") || 
				error?.message?.includes("401") ||
				error?.message?.includes("No valid authentication tokens found")) {
				return false;
			}
			// Retry other errors up to 2 times
			return failureCount < 2;
		},
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const loginMutation = useMutation({
		mutationFn: async (credentials: LoginCredentials) => {
			// TanStack Query handles server state
			const result = await authService.login(credentials);
			if (!result.success) {
				throw new Error(result.error || "Login failed");
			}
			return result.data;
		},
		onSuccess: (authResponse) => {
			// Update React Query cache with user data
			queryClient.setQueryData(
				[AUTH_QUERY_KEY, "user"],
				authResponse.user
			);

			toast.success("Login successful!");
			logger.info("User logged in successfully", {
				userId: authResponse.user.id,
			});

			// Use AuthStore for client-side navigation
			authStore.navigateAfterLogin();
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(errorMessage);
			logger.error("Login mutation failed", { error: errorMessage });
		},
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			// TanStack Query handles server state
			const result = await authService.logout();
			return result.data;
		},
		onSuccess: () => {
			// Clear React Query cache
			queryClient.removeQueries({ queryKey: [AUTH_QUERY_KEY] });

			toast.success("Logged out successfully");
			logger.info("User logged out successfully");

			// Use AuthStore for client-side navigation
			authStore.navigateAfterLogout();
		},
		onError: (error: unknown) => {
			// Clear cache even on error
			queryClient.removeQueries({ queryKey: [AUTH_QUERY_KEY] });

			const errorMessage = getErrorMessage(error);
			logger.warn("Logout had errors but redirecting anyway", {
				error: errorMessage,
			});

			// Use AuthStore for fallback navigation
			authStore.navigateAfterLogout();
		},
	});

	const login = (credentials: LoginCredentials) => {
		loginMutation.mutate(credentials);
	};

	const logout = () => {
		logoutMutation.mutate();
	};

	// Extract user data from TanStack Query
	const user = userQuery.data;
	const isAuthenticated = !!user;

	return {
		// Server state from TanStack Query
		user,
		isAuthenticated,
		isLoading: userQuery.isLoading,

		// Mutation functions
		login,
		logout,

		// Mutation states
		isLoggingIn: loginMutation.isPending,
		isLoggingOut: logoutMutation.isPending,

		// Error states
		loginError: loginMutation.error,
		userError: userQuery.error,
		error: userQuery.error || loginMutation.error || logoutMutation.error,

		// Query controls
		refetchUser: userQuery.refetch,

		// Client state from AuthStore
		isNavigating: authStore.isNavigating,
		redirectPath: authStore.redirectPath,
		setRedirectPath: authStore.setRedirectPath.bind(authStore),
	};
};
