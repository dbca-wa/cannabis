import axiosInstance from "./axiosInstance";

export interface PoliceStation {
	id: number;
	name: string;
	address?: string;
	phone_number?: string;
	email?: string;
	created_at?: string;
	updated_at?: string;
}

export interface PoliceStationMembership {
	id: number;
	station: PoliceStation;
	user: {
		id: number;
		username: string;
		first_name: string;
		last_name: string;
	};
	created_at: string;
	updated_at: string;
}

export interface OrganisationsResponse {
	organisations: PoliceStation[];
	total_results?: number;
	total_pages?: number;
}

export const organisationsApi = {
	// Get all police stations
	getAllPoliceStations: async (): Promise<PoliceStation[]> => {
		const response = await axiosInstance.get("/organisations/");
		return response.data;
	},

	// Get police station by ID
	getPoliceStationById: async (
		id: number | string
	): Promise<PoliceStation> => {
		const response = await axiosInstance.get(`/organisations/${id}`);
		return response.data;
	},

	// Create police station (admin only)
	createPoliceStation: async (
		stationData: Partial<PoliceStation>
	): Promise<PoliceStation> => {
		const response = await axiosInstance.post(
			"/organisations",
			stationData
		);
		return response.data;
	},

	// Update police station (admin only)
	updatePoliceStation: async (
		id: number | string,
		stationData: Partial<PoliceStation>
	): Promise<PoliceStation> => {
		const response = await axiosInstance.put(
			`/organisations/${id}`,
			stationData
		);
		return response.data;
	},

	// Delete police station (admin only)
	deletePoliceStation: async (id: number | string): Promise<void> => {
		await axiosInstance.delete(`/organisations/${id}`);
	},
};

// Keep the old name for backward compatibility but use the new API
export const stationsApi = organisationsApi;

// Export Station type for backward compatibility
export type Station = PoliceStation;
