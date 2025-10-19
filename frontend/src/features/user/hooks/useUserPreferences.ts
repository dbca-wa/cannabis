import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPreferencesService } from "@/features/user/services/userPreferences.service";
import type { UserPreferences } from "@/shared/types/backend-api.types";
import { logger } from "@/shared/services/logger.service";
import { toast } from "sonner";

/**
 * Query keys for user preferences
 */
export const userPreferencesQueryKeys = {
	all: ["user-preferences"] as const,
	preferences: () => [...userPreferencesQueryKeys.all, "current"] as const,
};

/**
 * Hook to get current user's preferences
 */
export function useUserPreferences() {
	return useQuery({
		queryKey: userPreferencesQueryKeys.preferences(),
		queryFn: UserPreferencesService.getPreferences,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
}

/**
 * Hook to update user preferences
 */
export function useUpdatePreferences() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (preferences: Partial<UserPreferences>) =>
			UserPreferencesService.updatePreferences(preferences),
		onMutate: async (newPreferences) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{ ...previousPreferences, ...newPreferences }
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, newPreferences, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update preferences", {
				error,
				preferences: newPreferences,
			});
			toast.error(
				"Failed to sync preferences. Changes saved locally only."
			);
		},
		onSuccess: (_, variables) => {
			logger.info("Preferences updated successfully", {
				preferences: variables,
			});
			// Don't show success toast for every preference change - too noisy
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}

/**
 * Hook to update theme preference specifically
 */
export function useUpdateTheme() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (theme: UserPreferences["theme"]) =>
			UserPreferencesService.updateTheme(theme),
		onMutate: async (theme) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{ ...previousPreferences, theme }
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, theme, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update theme", { error, theme });
			toast.error("Failed to sync theme. Changes saved locally only.");
		},
		onSuccess: (_, theme) => {
			logger.info("Theme updated successfully", { theme });
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}

/**
 * Hook to update loader style preference specifically
 */
export function useUpdateLoaderStyle() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (loader_style: UserPreferences["loader_style"]) =>
			UserPreferencesService.updateLoaderStyle(loader_style),
		onMutate: async (loader_style) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{ ...previousPreferences, loader_style }
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, loader_style, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update loader style", {
				error,
				loader_style,
			});
			toast.error(
				"Failed to sync loader style. Changes saved locally only."
			);
		},
		onSuccess: (_, loader_style) => {
			logger.info("Loader style updated successfully", { loader_style });
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}



/**
 * Hook to update UI preferences specifically
 */
export function useUpdateUIPreferences() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (ui_preferences: UserPreferences["ui_preferences"]) =>
			UserPreferencesService.updateUIPreferences(ui_preferences),
		onMutate: async (ui_preferences) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{ ...previousPreferences, ui_preferences }
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, preferences, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update UI preferences", {
				error,
				preferences,
			});
			toast.error(
				"Failed to sync UI preferences. Changes saved locally only."
			);
		},
		onSuccess: (_, preferences) => {
			logger.info("UI preferences updated successfully", { preferences });
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}

/**
 * Hook to update table filter preferences specifically
 */
export function useUpdateTableFilterPreferences() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			table_filter_preferences: UserPreferences["table_filter_preferences"]
		) =>
			UserPreferencesService.updateTableFilterPreferences(
				table_filter_preferences
			),
		onMutate: async (newTableFilters) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{
						...previousPreferences,
						table_filter_preferences: newTableFilters,
					}
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, newTableFilters, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update table filter preferences", {
				error,
				filters: newTableFilters,
			});
			toast.error(
				"Failed to sync table filters. Changes saved locally only."
			);
		},
		onSuccess: (_, filters) => {
			logger.debug("Table filter preferences updated successfully", {
				filters,
			});
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}

/**
 * Hook to update specific table filters (officers, stations, users)
 */
export function useUpdateSpecificTableFilters() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			tableName,
			filters,
		}: {
			tableName: string;
			filters: Record<string, unknown>;
		}) =>
			UserPreferencesService.updateSpecificTableFilters(
				tableName,
				filters
			),
		onMutate: async ({ tableName, filters }) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});

			// Snapshot the previous value
			const previousPreferences =
				queryClient.getQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences()
				);

			// Optimistically update to the new value
			if (previousPreferences) {
				const currentTablePrefs =
					previousPreferences.table_filter_preferences || {};
				const updatedTablePrefs = {
					...currentTablePrefs,
					[tableName]: {
						...(currentTablePrefs[tableName] || {}),
						...filters,
					},
				};

				queryClient.setQueryData<UserPreferences>(
					userPreferencesQueryKeys.preferences(),
					{
						...previousPreferences,
						table_filter_preferences: updatedTablePrefs,
					}
				);
			}

			// Return a context object with the snapshotted value
			return { previousPreferences };
		},
		onError: (error, { tableName, filters }, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousPreferences) {
				queryClient.setQueryData(
					userPreferencesQueryKeys.preferences(),
					context.previousPreferences
				);
			}

			logger.error("Failed to update specific table filters", {
				error,
				tableName,
				filters,
			});
			toast.error(
				"Failed to sync table filters. Changes saved locally only."
			);
		},
		onSuccess: (_, { tableName, filters }) => {
			logger.debug("Specific table filters updated successfully", {
				tableName,
				filters,
			});
		},
		onSettled: () => {
			// Always refetch after error or success to ensure we have the latest data
			queryClient.invalidateQueries({
				queryKey: userPreferencesQueryKeys.preferences(),
			});
		},
	});
}
