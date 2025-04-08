// api/usersApi.ts
import axiosInstance from "./axiosInstance";

export const usersApi = {
	getUsers: async () => {
		const response = await axiosInstance.get("/users/");
		return response.data;
	},

	getUserById: async (id: number | string) => {
		const response = await axiosInstance.get(`/users/${id}/`);
		return response.data;
	},

	createUser: async (userData: any) => {
		const response = await axiosInstance.post("/users/", userData);
		return response.data;
	},

	updateUser: async (id: number | string, userData: any) => {
		const response = await axiosInstance.put(`/users/${id}/`, userData);
		return response.data;
	},

	deleteUser: async (id: number | string) => {
		const response = await axiosInstance.delete(`/users/${id}/`);
		return response.data;
	},
};
