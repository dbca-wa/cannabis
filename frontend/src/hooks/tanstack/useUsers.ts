import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/usersApi";
import { User, UserDetail } from "@/types";

// Custom hook for user query by ID
export const useUserById = (id: string | number) => {
	const userQuery = useQuery({
		queryKey: ["user", id],
		queryFn: () => usersApi.getUserById(id),
		// Add some cache management options
		staleTime: 0, // Always consider data stale so it refetches when needed
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
	});

	return {
		// Queries
		user: userQuery.data as UserDetail,
		isLoading: userQuery.isLoading,
		error: userQuery.error,
		refetch: userQuery.refetch,
	};
};

export const useUsers = () => {
	const queryClient = useQueryClient();

	// Get all users
	const usersQuery = useQuery({
		queryKey: ["users"],
		queryFn: usersApi.getUsers,
	});

	// Create user mutation
	const createUserMutation = useMutation({
		mutationFn: usersApi.createUser,
		onSuccess: () => {
			// Invalidate the users list query when a new user is created
			queryClient.invalidateQueries({ queryKey: ["users"] });
		},
	});

	// Update user mutation
	const updateUserMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string | number;
			data: Partial<User>;
		}) => usersApi.updateUser(id, data),
		onSuccess: (updatedUser, variables) => {
			console.log(
				"Update successful, invalidating cache for user:",
				variables.id
			);

			// Method 1: Invalidate queries (forces refetch)
			queryClient.invalidateQueries({ queryKey: ["users"] });
			queryClient.invalidateQueries({ queryKey: ["user", variables.id] });

			// Method 2: Also manually update the cache with the new data
			// This provides immediate feedback while the refetch happens
			if (updatedUser) {
				queryClient.setQueryData(["user", variables.id], updatedUser);
			}

			// Method 3: Remove the specific user query from cache to force fresh fetch
			queryClient.removeQueries({ queryKey: ["user", variables.id] });
		},
		onError: (error, variables) => {
			console.error("Update failed for user:", variables.id, error);
		},
	});

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: usersApi.deleteUser,
		onSuccess: (_, deletedUserId) => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
			// Remove the deleted user from cache
			queryClient.removeQueries({ queryKey: ["user", deletedUserId] });
		},
	});

	// Function to prefetch a user (can be called imperatively)
	const prefetchUser = async (id: string | number) => {
		await queryClient.prefetchQuery({
			queryKey: ["user", id],
			queryFn: () => usersApi.getUserById(id),
		});
	};

	// Function to manually refresh a specific user
	const refreshUser = async (id: string | number) => {
		await queryClient.invalidateQueries({ queryKey: ["user", id] });
	};

	return {
		// Queries
		users: (usersQuery.data?.users || []) as User[],
		totalResults: usersQuery.data?.total_results || 0,
		totalPages: usersQuery.data?.total_pages || 0,

		isLoading: usersQuery.isLoading,
		error: usersQuery.error,

		// Functions
		prefetchUser,
		refreshUser, // New function to manually refresh a user
		createUser: createUserMutation.mutate,
		updateUser: updateUserMutation.mutate,
		deleteUser: deleteUserMutation.mutate,

		// Mutation states
		isCreating: createUserMutation.isPending,
		isUpdating: updateUserMutation.isPending,
		isDeleting: deleteUserMutation.isPending,
	};
};
