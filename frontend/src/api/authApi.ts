// api/authApi.ts
import axiosInstance from "./axiosInstance";

export const authApi = {
	login: (credentials: { email: string; password: string }) => {
		console.log(credentials);
		return axiosInstance.post("/users/login", credentials);
	},

	register: (userData: {
		username: string;
		email: string;
		password: string;
	}) => {
		return axiosInstance.post("/users/signup", userData);
	},

	getCurrentUser: () => {
		return axiosInstance.get("/users/whoami");
	},
};
