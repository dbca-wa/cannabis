import { makeAutoObservable, runInAction } from "mobx";
import { organisationsApi, PoliceStation } from "@/api/stationsApi";

export class StationStore {
	stations: PoliceStation[] = [];
	isLoading: boolean = false;
	error: string | null = null;
	lastFetchTime: number = 0;
	private cacheDuration: number = 5 * 60 * 1000; // 5 minutes cache

	constructor() {
		makeAutoObservable(this);
	}

	get stationsMap(): Map<number, PoliceStation> {
		return new Map(this.stations.map((station) => [station.id, station]));
	}

	get activeStations(): PoliceStation[] {
		return this.stations;
	}

	get stationOptions() {
		return this.activeStations.map((station) => ({
			id: station.id,
			name: station.name,
			value: station.id.toString(),
		}));
	}

	// Get station by ID
	getStationById = (id: number): PoliceStation | undefined => {
		return this.stationsMap.get(id);
	};

	// Get station by name
	getStationByName = (name: string): PoliceStation | undefined => {
		return this.stations.find(
			(station) => station.name.toLowerCase() === name.toLowerCase()
		);
	};

	// Search stations by name
	searchStations = (searchTerm: string): PoliceStation[] => {
		if (!searchTerm.trim()) {
			return this.activeStations;
		}

		const term = searchTerm.toLowerCase();
		return this.activeStations.filter(
			(station) =>
				station.name.toLowerCase().includes(term) ||
				(station.address &&
					station.address.toLowerCase().includes(term))
		);
	};

	// Check if cache is still valid
	private isCacheValid(): boolean {
		return Date.now() - this.lastFetchTime < this.cacheDuration;
	}

	// Fetch all stations
	fetchStations = async (force: boolean = false) => {
		// If we have cached data and it's still valid, don't refetch
		if (!force && this.stations.length > 0 && this.isCacheValid()) {
			return;
		}

		if (this.isLoading) {
			return; // Already loading
		}

		this.isLoading = true;
		this.error = null;

		try {
			const stations = await organisationsApi.getAllPoliceStations();

			runInAction(() => {
				this.stations = stations;
				this.lastFetchTime = Date.now();
				this.isLoading = false;
			});
		} catch (error) {
			runInAction(() => {
				this.error =
					error instanceof Error
						? error.message
						: "Failed to fetch stations";
				this.isLoading = false;
			});
			console.error("Failed to fetch stations:", error);
		}
	};

	// Force refresh stations
	refreshStations = async () => {
		await this.fetchStations(true);
	};

	// Add a new station (optimistic update)
	addStation = async (stationData: Partial<PoliceStation>) => {
		try {
			const newStation = await organisationsApi.createPoliceStation(
				stationData
			);

			runInAction(() => {
				this.stations.push(newStation);
			});

			return newStation;
		} catch (error) {
			this.error =
				error instanceof Error
					? error.message
					: "Failed to create station";
			throw error;
		}
	};

	// Update a station (optimistic update)
	updateStation = async (id: number, stationData: Partial<PoliceStation>) => {
		const originalStations = [...this.stations];

		try {
			// Optimistic update
			runInAction(() => {
				const index = this.stations.findIndex((s) => s.id === id);
				if (index !== -1) {
					this.stations[index] = {
						...this.stations[index],
						...stationData,
					};
				}
			});

			const updatedStation = await organisationsApi.updatePoliceStation(
				id,
				stationData
			);

			runInAction(() => {
				const index = this.stations.findIndex((s) => s.id === id);
				if (index !== -1) {
					this.stations[index] = updatedStation;
				}
			});

			return updatedStation;
		} catch (error) {
			// Revert optimistic update
			runInAction(() => {
				this.stations = originalStations;
			});

			this.error =
				error instanceof Error
					? error.message
					: "Failed to update station";
			throw error;
		}
	};

	// Delete a station (optimistic update)
	deleteStation = async (id: number) => {
		const originalStations = [...this.stations];

		try {
			// Optimistic update
			runInAction(() => {
				this.stations = this.stations.filter((s) => s.id !== id);
			});

			await organisationsApi.deletePoliceStation(id);
		} catch (error) {
			// Revert optimistic update
			runInAction(() => {
				this.stations = originalStations;
			});

			this.error =
				error instanceof Error
					? error.message
					: "Failed to delete station";
			throw error;
		}
	};

	// Clear error
	clearError = () => {
		this.error = null;
	};

	// Initialize stations (call this when the app starts)
	initialize = async () => {
		if (this.stations.length === 0) {
			await this.fetchStations();
		}
	};
}
