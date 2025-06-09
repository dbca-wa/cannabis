import axios from "axios";

const VITE_PRODUCTION_BACKEND_API_URL = import.meta.env
	.VITE_PRODUCTION_BACKEND_API_URL;

const baseBackendUrl =
	process.env.NODE_ENV === "development"
		? "http://127.0.0.1:8000/api/v1/"
		: VITE_PRODUCTION_BACKEND_API_URL;

export const baseInstance = axios.create({
	baseURL: (baseBackendUrl as string).replace("api/v1/", ""),
	withCredentials: true, // Essential for session cookies
});

const axiosInstance = axios.create({
	baseURL: baseBackendUrl,
	headers: {
		"Content-Type": "application/json",
	},
	withCredentials: true, // Essential for session cookies and CSRF
});

// Function to get CSRF token from cookies
const getCSRFToken = () => {
	const name = "cannabis_cookie="; // Your custom CSRF cookie name from settings
	const decodedCookie = decodeURIComponent(document.cookie);
	console.log("All cookies:", decodedCookie); // Debug line
	const ca = decodedCookie.split(";");
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === " ") {
			c = c.substring(1);
		}
		if (c.indexOf(name) === 0) {
			const token = c.substring(name.length, c.length);
			console.log("Found CSRF token:", token); // Debug line
			return token;
		}
	}
	console.log("CSRF token not found"); // Debug line
	return null;
};

// Request interceptor to add CSRF token
axiosInstance.interceptors.request.use(
	(config) => {
		// Add CSRF token for unsafe methods
		if (
			["post", "put", "patch", "delete"].includes(
				config.method?.toLowerCase() || ""
			)
		) {
			const csrfToken = getCSRFToken();
			if (csrfToken) {
				config.headers["X-CSRFToken"] = csrfToken;
			}
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor for session handling
axiosInstance.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error) => {
		const originalRequest = error.config;

		// Handle 401/403 Unauthorized errors (session expired)
		if (
			(error.response?.status === 401 ||
				error.response?.status === 403) &&
			!originalRequest._retry
		) {
			originalRequest._retry = true;

			// Redirect to login page
			window.location.href = "/auth/login";
		}

		return Promise.reject(error);
	}
);

export default axiosInstance;
