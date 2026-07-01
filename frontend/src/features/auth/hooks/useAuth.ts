import { rootStore } from "@/app/stores/root.store";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
	login as loginService,
	logout as logoutService,
	getCurrentUser,
} from "../services/auth.service";
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
			try {
				return await getCurrentUser();
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				if (
					msg.includes("403") ||
					msg.includes("401") ||
					msg.includes("No valid authentication tokens found")
				) {
					return null;
				}
				throw error;
			}
		},
		retry: (failureCount, error) => {
			const msg = error?.message || "";
			if (
				msg.includes("403") ||
				msg.includes("401") ||
				msg.includes("No valid authentication tokens found")
			) {
				return false;
			}
			return failureCount < 2;
		},
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const loginMutation = useMutation({
		mutationFn: (credentials: LoginCredentials) => loginService(credentials),
		onSuccess: (authResponse) => {
			// Drop any cached data from a prior session before seeding the new user
			queryClient.clear();
			queryClient.setQueryData([AUTH_QUERY_KEY, "user"], authResponse.user);

			toast.success("Login successful!");
			logger.info("User logged in successfully", {
				userId: authResponse.user.id,
			});

			authStore.navigateAfterLogin();
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(errorMessage);
			logger.error("Login mutation failed", { error: errorMessage });
		},
	});

	const logoutMutation = useMutation({
		mutationFn: () => logoutService(),
		onSuccess: () => {
			// Clear all cached data so the next user never sees stale results
			queryClient.clear();
			toast.success("Logged out successfully");
			logger.info("User logged out successfully");
			authStore.navigateAfterLogout();
		},
		onError: (error: unknown) => {
			queryClient.clear();
			const errorMessage = getErrorMessage(error);
			logger.warn("Logout had errors but redirecting anyway", {
				error: errorMessage,
			});
			authStore.navigateAfterLogout();
		},
	});

	const login = (credentials: LoginCredentials) => {
		loginMutation.mutate(credentials);
	};

	const logout = () => {
		logoutMutation.mutate();
	};

	const user = userQuery.data;
	const isAuthenticated = !!user;

	// Effective role — admins (superuser/staff) take precedence over the role field.
	const isAdmin = !!(user?.is_superuser || user?.is_staff);
	const hasRole = user?.role === "botanist" || user?.role === "finance";
	const hasAppAccess = isAdmin || hasRole;
	const effectiveRole: "admin" | "botanist" | "finance" | "none" = isAdmin
		? "admin"
		: hasRole
			? (user!.role as "botanist" | "finance")
			: "none";

	return {
		user,
		isAuthenticated,
		isLoading: userQuery.isLoading,

		// Role / access helpers
		isAdmin,
		hasRole,
		hasAppAccess,
		effectiveRole,

		login,
		logout,

		isLoggingIn: loginMutation.isPending,
		isLoggingOut: logoutMutation.isPending,

		loginError: loginMutation.error,
		userError: userQuery.error,
		error: userQuery.error || loginMutation.error || logoutMutation.error,

		refetchUser: userQuery.refetch,

		isNavigating: authStore.isNavigating,
		redirectPath: authStore.redirectPath,
		setRedirectPath: authStore.setRedirectPath.bind(authStore),
	};
};
