// api/authApi.ts
import axiosInstance from "./axiosInstance";

export const authApi = {
	login: (credentials: { username: string; password: string }) => {
		return axiosInstance.post("/auth/login/", credentials);
	},

	register: (userData: {
		username: string;
		email: string;
		password: string;
	}) => {
		return axiosInstance.post("/auth/register/", userData);
	},

	getCurrentUser: () => {
		return axiosInstance.get("/auth/user/");
	},

	refreshToken: (refreshToken: string) => {
		return axiosInstance.post("/auth/token/refresh/", {
			refresh: refreshToken,
		});
	},
};
