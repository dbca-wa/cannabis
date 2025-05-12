// api/authApi.ts
import axiosInstance from "./axiosInstance";
import { baseInstance } from "./axiosInstance";

export const authApi = {
	login: (credentials: { email: string; password: string }) => {
		return baseInstance.post("/auth/login/", credentials);
	},

	register: (userData: {
		username: string;
		email: string;
		password: string;
	}) => {
		return baseInstance.post("/auth/signup/", userData);
	},

	refreshToken: (refreshToken: string) => {
		return baseInstance.post("/auth/token/refresh/", {
			refresh: refreshToken,
		});
	},

	getCurrentUser: () => {
		return axiosInstance.get("/users/whoami/");
	},
};
