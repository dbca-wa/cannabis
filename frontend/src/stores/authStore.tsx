import { makeAutoObservable } from "mobx";
import { authService } from "@/api/authService";
import { User } from "@/types";

interface AuthError {
	response?: {
		data?: {
			message?: string;
		};
	};
	message?: string;
}

export class AuthStore {
	user: User | null = null;
	isLoading: boolean = false;
	error: string | null = null;
	private authCheckAttempted: boolean = false; // Circuit breaker flag

	constructor() {
		makeAutoObservable(this);
		this.checkAuthStatus();
	}

	get isAuthenticated() {
		return !!this.user;
	}

	get isAdmin() {
		return this.user?.is_superuser || false;
	}

	async checkAuthStatus() {
		// Circuit breaker: only check once on initial load
		if (this.authCheckAttempted) {
			console.log("AuthStore: Auth check already attempted, skipping");
			return;
		}

		this.isLoading = true;
		this.error = null;
		this.authCheckAttempted = true;

		try {
			console.log("AuthStore: Starting auth check...");

			// First ensure we have a CSRF token
			await authService.ensureCSRFToken();
			console.log("AuthStore: CSRF token obtained");

			const user = await authService.getCurrentUser();
			console.log("AuthStore: Got user data:", user);

			this.setUser(user);
		} catch (error) {
			console.log("AuthStore: Auth check failed:", error);
			this.setUser(null);
			// Store the error but don't throw it
			this.error =
				error instanceof Error
					? error.message
					: "Authentication failed";
		} finally {
			this.isLoading = false;
			console.log(
				"AuthStore: Auth check completed, isAuthenticated:",
				this.isAuthenticated
			);
		}
	}

	// Reset the circuit breaker when manually logging in
	async login(email: string, password: string) {
		this.isLoading = true;
		this.error = null;
		try {
			await authService.login(email, password);
			// After successful login, get user data
			const user = await authService.getCurrentUser();
			this.setUser(user);
			// Reset the circuit breaker since we're now authenticated
			this.authCheckAttempted = true;
		} catch (error) {
			const authError = error as AuthError;
			const errorMessage =
				authError.response?.data?.message ||
				authError.message ||
				"Login failed";

			this.error = errorMessage;
			console.error("Login error:", errorMessage);
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	async logout() {
		this.isLoading = true;
		try {
			await authService.logout();
			this.setUser(null);
			// Reset circuit breaker for next session
			this.authCheckAttempted = false;
		} catch (error) {
			console.error("Logout error:", error);
			// Even if logout fails, clear user data
			this.setUser(null);
			this.authCheckAttempted = false;
		} finally {
			this.isLoading = false;
		}
	}

	setUser(user: User | null) {
		this.user = user;
	}

	clearError() {
		this.error = null;
	}

	// Method to manually reset auth check (for debugging)
	resetAuthCheck() {
		this.authCheckAttempted = false;
		this.checkAuthStatus();
	}
}

// // Create and export a singleton instance
// export const authStore = new AuthStore();
