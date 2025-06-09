import axiosInstance from "./axiosInstance";

export const authService = {
	async checkAuthStatus(): Promise<boolean> {
		try {
			const response = await axiosInstance.get("users/whoami");
			return response.status === 200;
		} catch (error) {
			return false;
		}
	},

	async getCurrentUser() {
		try {
			const response = await axiosInstance.get("users/whoami");
			return response.data;
		} catch (error) {
			console.error("Get current user failed:", error);
			return null;
		}
	},

	async login(email: string, password: string) {
		try {
			// First get CSRF token
			await axiosInstance.get("users/csrf");

			const response = await axiosInstance.post("users/login", {
				username: email, // Backend expects username field
				password,
			});

			if (response.status === 200) {
				return response.data;
			} else {
				throw new Error("Login failed");
			}
		} catch (error: any) {
			console.error("Login failed:", error);
			throw new Error(error.response?.data?.error || "Login failed");
		}
	},

	async logout() {
		try {
			const response = await axiosInstance.post("users/logout");

			if (response.data?.logoutUrl) {
				// Handle DBCA logout URL
				window.location.href = response.data.logoutUrl;
			} else {
				// Regular logout - redirect to login
				window.location.href = "/auth/login";
			}

			return response.data;
		} catch (error) {
			console.error("Logout failed:", error);
			// Even if logout fails, redirect to login
			window.location.href = "/auth/login";
		}
	},

	async ensureCSRFToken() {
		try {
			await axiosInstance.get("users/csrf");
		} catch (error) {
			console.error("Failed to get CSRF token:", error);
		}
	},
};
