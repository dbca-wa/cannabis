import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usersService } from "../services/users.service";
import {
	type IUser,
	type EditUserFormData,
	type UserSearchParams,
} from "@/features/user/types/users.types";
import type { AddUserFormData } from "../components/forms/schemas/addUserSchema";

// Standardized query keys following police/defendants pattern
export const usersQueryKeys = {
	all: ["users"] as const,
	lists: () => [...usersQueryKeys.all, "list"] as const,
	list: (params: UserSearchParams) =>
		[...usersQueryKeys.lists(), params] as const,
	details: () => [...usersQueryKeys.all, "detail"] as const,
	detail: (id: number) => [...usersQueryKeys.details(), id] as const,
};

export const useUsers = (params: UserSearchParams = {}) => {
	const queryClient = useQueryClient();

	// Query for fetching users with pagination and filtering - using standardized query keys
	const usersQuery = useQuery({
		queryKey: usersQueryKeys.list(params),
		queryFn: async () => {
			const result = await usersService.getUsers(params);
			if (!result.success) {
				throw new Error(result.error || "Failed to fetch users");
			}
			return result.data;
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});

	// Create user mutation
	const createUserMutation = useMutation({
		mutationFn: async (userData: AddUserFormData) => {
			logger.info("Creating user", { email: userData.email });
			const result = await usersService.createUser(userData);
			if (!result.success) {
				throw new Error(result.error || "Failed to create user");
			}
			return result.data;
		},
		onSuccess: async (newUser) => {
			// Update specific user cache
			queryClient.setQueryData(
				usersQueryKeys.detail(newUser.id),
				newUser
			);

			// Invalidate users list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: usersQueryKeys.lists(),
			});

			toast.success(`User "${newUser.full_name}" created successfully!`);
			logger.info("User created via hook", {
				userId: newUser.id,
				email: newUser.email,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to create user: ${errorMessage}`);
			logger.error("Create user failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Update user mutation
	const updateUserMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string | number;
			data: EditUserFormData;
		}) => {
			logger.info("Updating user", { userId: id });
			const result = await usersService.updateUser(id, data);
			if (!result.success) {
				throw new Error(result.error || "Failed to update user");
			}
			return result.data;
		},
		onSuccess: async (updatedUser, variables) => {
			// Update user in cache
			queryClient.setQueryData(
				usersQueryKeys.detail(
					typeof variables.id === "string"
						? parseInt(variables.id)
						: variables.id
				),
				updatedUser
			);

			// Invalidate users list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: usersQueryKeys.lists(),
			});

			toast.success(
				`User "${updatedUser.full_name}" updated successfully!`
			);
			logger.info("User updated via hook", { userId: variables.id });
		},
		onError: (error: unknown, variables) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to update user: ${errorMessage}`);
			logger.error("Update user failed via hook", {
				userId: variables.id,
				error: errorMessage,
			});
		},
	});

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: async (userId: string | number) => {
			logger.info("Deleting user", { userId });
			const result = await usersService.deleteUser(userId);
			if (!result.success) {
				throw new Error(result.error || "Failed to delete user");
			}
			return result.data;
		},
		onSuccess: async (_, deletedUserId) => {
			// Remove user from cache
			queryClient.removeQueries({
				queryKey: usersQueryKeys.detail(
					typeof deletedUserId === "string"
						? parseInt(deletedUserId)
						: deletedUserId
				),
			});

			// Invalidate users list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: usersQueryKeys.lists(),
			});

			toast.success("User deleted successfully!");
			logger.info("User deleted via hook", { userId: deletedUserId });
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to delete user: ${errorMessage}`);
			logger.error("Delete user failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Invite user mutation
	const inviteUserMutation = useMutation({
		mutationFn: async (inviteData: {
			external_user_data: {
				email: string;
				[key: string]: any;
			};
			role: string;
			is_staff?: boolean;
			is_active?: boolean;
		}) => {
			logger.info("Sending user invitation", {
				email: inviteData.external_user_data?.email,
				role: inviteData.role,
			});
			const result = await usersService.inviteUser(inviteData);
			if (!result.success) {
				throw new Error(result.error || "Failed to send invitation");
			}
			return result.data;
		},
		onSuccess: async (newUser) => {
			// Update specific user cache
			queryClient.setQueryData(
				usersQueryKeys.detail(newUser.id),
				newUser
			);

			// Invalidate users list queries to refresh tables immediately
			queryClient.invalidateQueries({
				queryKey: usersQueryKeys.lists(),
			});

			toast.success(
				`Invitation sent to "${newUser.full_name}" successfully!`
			);
			logger.info("User invitation sent via hook", {
				userId: newUser.id,
				email: newUser.email,
			});
		},
		onError: (error: unknown) => {
			const errorMessage = getErrorMessage(error);
			toast.error(`Failed to send invitation: ${errorMessage}`);
			logger.error("Send invitation failed via hook", {
				error: errorMessage,
			});
		},
	});

	// Utility functions with better error handling
	const createUser = (
		data: AddUserFormData,
		options?: {
			onSuccess?: (user: IUser) => void;
			onError?: (error: unknown) => void;
		}
	) => {
		createUserMutation.mutate(data, {
			onSuccess: (user) => {
				options?.onSuccess?.(user);
			},
			onError: (error) => {
				options?.onError?.(error);
			},
		});
	};

	const updateUser = (
		data: { id: string | number; data: EditUserFormData },
		options?: {
			onSuccess?: (user: IUser) => void;
			onError?: (error: unknown) => void;
		}
	) => {
		updateUserMutation.mutate(data, {
			onSuccess: (user) => {
				options?.onSuccess?.(user);
			},
			onError: (error) => {
				options?.onError?.(error);
			},
		});
	};

	const deleteUser = (
		userId: string | number,
		options?: {
			onSuccess?: () => void;
			onError?: (error: unknown) => void;
		}
	) => {
		deleteUserMutation.mutate(userId, {
			onSuccess: () => {
				options?.onSuccess?.();
			},
			onError: (error) => {
				options?.onError?.(error);
			},
		});
	};

	const inviteUser = (
		inviteData: {
			external_user_data: {
				email: string;
				[key: string]: unknown;
			};
			role: string;
			is_staff?: boolean;
			is_active?: boolean;
		},
		options?: {
			onSuccess?: (user: IUser) => void;
			onError?: (error: unknown) => void;
		}
	) => {
		inviteUserMutation.mutate(inviteData, {
			onSuccess: (user) => {
				options?.onSuccess?.(user);
			},
			onError: (error) => {
				options?.onError?.(error);
			},
		});
	};

	// Refresh function
	const refreshUsers = () => {
		queryClient.invalidateQueries({ queryKey: usersQueryKeys.lists() });
	};

	// Extract data
	const usersData = usersQuery.data;
	const users = usersData?.results || [];
	const totalResults = usersData?.count || 0;

	return {
		// Data
		users,
		totalResults,
		usersData,

		// Query states
		isLoading: usersQuery.isLoading,
		isFetching: usersQuery.isFetching,
		error: usersQuery.error,
		isError: usersQuery.isError,

		// Mutation functions
		createUser,
		updateUser,
		deleteUser,
		inviteUser,
		refreshUsers,

		// Mutation states
		isCreating: createUserMutation.isPending,
		isUpdating: updateUserMutation.isPending,
		isDeleting: deleteUserMutation.isPending,
		isInviting: inviteUserMutation.isPending,

		// Individual mutation objects for advanced usage
		createUserMutation,
		updateUserMutation,
		deleteUserMutation,
		inviteUserMutation,

		// Raw query for advanced usage
		query: usersQuery,
	};
};
