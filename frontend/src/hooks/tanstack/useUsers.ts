// hooks/tanstack/useUsers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/usersApi";
import { User } from "@/types";

// Custom hook for user query by ID
export const useUserById = (id: string | number) => {
	return useQuery({
		queryKey: ["user", id],
		queryFn: () => usersApi.getUserById(id),
	});
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
		onSuccess: (_, variables) => {
			// Invalidate both the list and the specific user query
			queryClient.invalidateQueries({ queryKey: ["users"] });
			queryClient.invalidateQueries({ queryKey: ["user", variables.id] });
		},
	});

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: usersApi.deleteUser,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
		},
	});

	// Function to prefetch a user (can be called imperatively)
	const prefetchUser = async (id: string | number) => {
		await queryClient.prefetchQuery({
			queryKey: ["user", id],
			queryFn: () => usersApi.getUserById(id),
		});
	};

	return {
		// Queries
		users: usersQuery.data || [],
		isLoading: usersQuery.isLoading,
		error: usersQuery.error,

		// Functions
		prefetchUser,
		createUser: createUserMutation.mutate,
		updateUser: updateUserMutation.mutate,
		deleteUser: deleteUserMutation.mutate,

		// Mutation states
		isCreating: createUserMutation.isPending,
		isUpdating: updateUserMutation.isPending,
		isDeleting: deleteUserMutation.isPending,
	};
};
