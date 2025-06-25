import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organisationsApi, PoliceStation } from "@/api/stationsApi";

// Hook for getting a single police station by ID
export const usePoliceStationById = (id: string | number) => {
	const stationQuery = useQuery({
		queryKey: ["policeStation", id],
		queryFn: () => organisationsApi.getPoliceStationById(id),
		staleTime: 2 * 60 * 1000, // 2 minutes - stations don't change often
		gcTime: 5 * 60 * 1000, // 5 minutes
		enabled: !!id, // Only run if ID is provided
	});

	return {
		station: stationQuery.data as PoliceStation,
		isLoading: stationQuery.isLoading,
		error: stationQuery.error,
		refetch: stationQuery.refetch,
	};
};

// Main hook for organisations/police stations
export const useOrganisations = () => {
	const queryClient = useQueryClient();

	// Get all police stations
	const stationsQuery = useQuery({
		queryKey: ["policeStations"],
		queryFn: organisationsApi.getAllPoliceStations,
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 5 * 60 * 1000, // 5 minutes
	});

	// Create police station mutation
	const createStationMutation = useMutation({
		mutationFn: organisationsApi.createPoliceStation,
		onSuccess: (newStation) => {
			console.log("Station created successfully:", newStation.id);
			// Invalidate the stations list query
			queryClient.invalidateQueries({ queryKey: ["policeStations"] });
			// Optionally add the new station to the cache immediately
			queryClient.setQueryData(
				["policeStation", newStation.id],
				newStation
			);
		},
		onError: (error) => {
			console.error("Failed to create station:", error);
		},
	});

	// Update police station mutation
	const updateStationMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string | number;
			data: Partial<PoliceStation>;
		}) => organisationsApi.updatePoliceStation(id, data),
		onSuccess: (updatedStation, variables) => {
			console.log("Station updated successfully:", variables.id);

			// Invalidate and refetch queries
			queryClient.invalidateQueries({ queryKey: ["policeStations"] });
			queryClient.invalidateQueries({
				queryKey: ["policeStation", variables.id],
			});

			// Update the specific station cache
			if (updatedStation) {
				queryClient.setQueryData(
					["policeStation", variables.id],
					updatedStation
				);
			}

			// Remove and force fresh fetch
			queryClient.removeQueries({
				queryKey: ["policeStation", variables.id],
			});
		},
		onError: (error, variables) => {
			console.error("Failed to update station:", variables.id, error);
		},
	});

	// Delete police station mutation
	const deleteStationMutation = useMutation({
		mutationFn: organisationsApi.deletePoliceStation,
		onSuccess: (_, deletedStationId) => {
			console.log("Station deleted successfully:", deletedStationId);
			// Invalidate the stations list
			queryClient.invalidateQueries({ queryKey: ["policeStations"] });
			// Remove the deleted station from cache
			queryClient.removeQueries({
				queryKey: ["policeStation", deletedStationId],
			});
		},
		onError: (error, stationId) => {
			console.error("Failed to delete station:", stationId, error);
		},
	});

	// Function to manually refresh all stations
	const refreshStations = async () => {
		await queryClient.invalidateQueries({ queryKey: ["policeStations"] });
	};

	// Function to manually refresh a specific station
	const refreshStation = async (id: string | number) => {
		await queryClient.invalidateQueries({
			queryKey: ["policeStation", id],
		});
	};

	// Function to prefetch a station
	const prefetchStation = async (id: string | number) => {
		await queryClient.prefetchQuery({
			queryKey: ["policeStation", id],
			queryFn: () => organisationsApi.getPoliceStationById(id),
		});
	};

	return {
		// Queries
		stations: (stationsQuery.data || []) as PoliceStation[],
		isLoading: stationsQuery.isLoading,
		error: stationsQuery.error,

		// Functions
		createStation: createStationMutation.mutate,
		updateStation: updateStationMutation.mutate,
		deleteStation: deleteStationMutation.mutate,
		refreshStations,
		refreshStation,
		prefetchStation,

		// Mutation states
		isCreating: createStationMutation.isPending,
		isUpdating: updateStationMutation.isPending,
		isDeleting: deleteStationMutation.isPending,

		// Mutation errors
		createError: createStationMutation.error,
		updateError: updateStationMutation.error,
		deleteError: deleteStationMutation.error,
	};
};

// Convenience hook that combines both - useful for backwards compatibility
export const useStations = useOrganisations;
