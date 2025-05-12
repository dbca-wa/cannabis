import { makeAutoObservable, runInAction } from "mobx";
import { authApi } from "@/api/authApi";
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
	token: string | null = localStorage.getItem("token");
	loading: boolean = false;
	error: string | null = null;

	constructor() {
		makeAutoObservable(this);
	}

	get isAuthenticated() {
		return !!this.token && !!this.user;
	}

	get isAdmin() {
		return this.user?.is_superuser || false;
	}

	// Explicitly handle loading state
	setLoading(loading: boolean) {
		runInAction(() => {
			this.loading = loading;
		});
	}

	clearError() {
		runInAction(() => {
			this.error = null;
		});
	}

	setError(error: string | null) {
		runInAction(() => {
			this.error = error;
		});
	}

	async checkAuth() {
		if (!this.token) return;

		this.setLoading(true);
		try {
			await this.getCurrentUser();
		} catch (error) {
			console.error("Auth check failed", error);
		} finally {
			this.setLoading(false);
		}
	}

	async login(credentials: { email: string; password: string }) {
		this.clearError();

		try {
			const response = await authApi.login(credentials);
			runInAction(() => {
				this.token = response.data.token;
				this.user = response.data.user;
				localStorage.setItem("token", response.data.token);
			});
			return true;
		} catch (error) {
			const authError = error as AuthError;
			const errorMessage =
				authError.response?.data?.message ||
				authError.message ||
				"Login failed";

			this.setError(errorMessage);
			console.error("Login error:", errorMessage);
			return false;
		}
	}

	async register(userData: {
		username: string;
		email: string;
		password: string;
	}) {
		this.clearError();
		this.setLoading(true);

		try {
			const response = await authApi.register(userData);
			runInAction(() => {
				this.token = response.data.token;
				this.user = response.data.user;
				localStorage.setItem("token", response.data.token);
			});
			return true;
		} catch (error) {
			const authError = error as AuthError;
			this.setError(
				authError.response?.data?.message ||
					authError.message ||
					"Registration failed"
			);
			return false;
		} finally {
			this.setLoading(false);
		}
	}

	async getCurrentUser() {
		if (!this.token) return;

		try {
			const response = await authApi.getCurrentUser();
			runInAction(() => {
				this.user = response.data;
			});
		} catch (error) {
			console.error("Get current user error:", error);
			this.logout();
		}
	}

	logout() {
		runInAction(() => {
			this.user = null;
			this.token = null;
			this.error = null;
			localStorage.removeItem("token");
		});
	}
}
