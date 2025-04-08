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
		return this.user?.isAdmin || false;
	}

	async checkAuth() {
		if (!this.token) return;

		this.loading = true;
		try {
			await this.getCurrentUser();
		} catch (error) {
			console.error("Auth check failed", error);
		} finally {
			runInAction(() => {
				this.loading = false;
			});
		}
	}

	async login(credentials: { username: string; password: string }) {
		this.loading = true;
		this.error = null;

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
			runInAction(() => {
				this.error =
					authError.response?.data?.message ||
					authError.message ||
					"Login failed";
			});
			return false;
		} finally {
			runInAction(() => {
				this.loading = false;
			});
		}
	}

	async register(userData: {
		username: string;
		email: string;
		password: string;
	}) {
		this.loading = true;
		this.error = null;

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
			runInAction(() => {
				this.error =
					authError.response?.data?.message ||
					authError.message ||
					"Registration failed";
			});
			return false;
		} finally {
			runInAction(() => {
				this.loading = false;
			});
		}
	}

	async getCurrentUser() {
		if (!this.token) return;

		this.loading = true;
		try {
			const response = await authApi.getCurrentUser();
			runInAction(() => {
				this.user = response.data;
			});
		} catch (error) {
			console.log(error);
			runInAction(() => {
				this.logout();
			});
		} finally {
			runInAction(() => {
				this.loading = false;
			});
		}
	}

	logout() {
		this.user = null;
		this.token = null;
		localStorage.removeItem("token");
	}
}
