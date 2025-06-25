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
	const name = "cannabis_cookie=";
	const decodedCookie = decodeURIComponent(document.cookie);
	console.log("Looking for CSRF cookie 'cannabis_cookie'");
	console.log("All cookies:", decodedCookie);

	if (!decodedCookie) {
		console.log("No cookies found at all");
		return null;
	}

	const ca = decodedCookie.split(";");
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === " ") {
			c = c.substring(1);
		}
		console.log(`Checking cookie ${i}: "${c}"`);
		if (c.indexOf(name) === 0) {
			const token = c.substring(name.length, c.length);
			console.log("Found CSRF token:", token);
			return token;
		}
	}
	console.log("CSRF token 'cannabis_cookie' not found");
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
// axiosInstance.interceptors.response.use(
// 	(response) => {
// 		return response;
// 	},
// 	async (error) => {
// 		const originalRequest = error.config;

// 		// Handle 401/403 Unauthorized errors (session expired)
// 		if (
// 			(error.response?.status === 401 ||
// 				error.response?.status === 403) &&
// 			!originalRequest._retry
// 		) {
// 			originalRequest._retry = true;

// 			// Redirect to login page
// 			window.location.href = "/auth/login";
// 		}

// 		return Promise.reject(error);
// 	}
// );

export default axiosInstance;
