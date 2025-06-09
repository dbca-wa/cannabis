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
		this.isLoading = true;
		try {
			const user = await authService.getCurrentUser();
			this.setUser(user);
		} catch (error) {
			console.debug("Auth check failed:", error);
			this.setUser(null);
		} finally {
			this.isLoading = false;
		}
	}

	async login(email: string, password: string) {
		this.isLoading = true;
		this.error = null;
		try {
			await authService.login(email, password);
			// After successful login, get user data
			const user = await authService.getCurrentUser();
			this.setUser(user);
		} catch (error) {
			const authError = error as AuthError;
			const errorMessage =
				authError.response?.data?.message ||
				authError.message ||
				"Login failed";

			this.error = errorMessage;
			console.error("Login error:", errorMessage);
			// return false;
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
		} catch (error) {
			console.error("Logout error:", error);
			// Even if logout fails, clear user data
			this.setUser(null);
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
}
