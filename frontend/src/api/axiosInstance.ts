import axios from "axios";
import { RootStore } from "@/stores/rootStore";

const VITE_PRODUCTION_BACKEND_API_URL = import.meta.env
	.VITE_PRODUCTION_BACKEND_API_URL;

const baseBackendUrl =
	process.env.NODE_ENV === "development"
		? "http://127.0.0.1:8000/api/v1/"
		: VITE_PRODUCTION_BACKEND_API_URL;

export const baseInstance = axios.create({
	// strip api v1
	baseURL: (baseBackendUrl as string).replace("api/v1/", ""),
});
const axiosInstance = axios.create({
	baseURL: baseBackendUrl,
	headers: {
		"Content-Type": "application/json",
	},
	//   withCredentials: true,
});

// Create a store reference that can be set later
let storeRef: RootStore | null = null;

// Function to set the store reference
export const setStoreRef = (store: RootStore) => {
	storeRef = store;
};

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
	(config) => {
		// Get token from the authStore via the store reference
		const token = storeRef?.authStore.token;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error) => {
		const originalRequest = error.config;

		// Handle 401 Unauthorized errors (token expired)
		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;
			// Call logout through the store reference
			storeRef?.authStore.logout();
			window.location.href = "/auth/login";
		}

		return Promise.reject(error);
	}
);

export default axiosInstance;
