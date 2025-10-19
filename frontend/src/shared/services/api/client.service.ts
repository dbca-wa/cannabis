import axios, {
	type AxiosInstance,
	type AxiosRequestConfig,
	AxiosError,
} from "axios";

// Extend AxiosRequestConfig to include retry flag
declare module "axios" {
	interface AxiosRequestConfig {
		_retry?: boolean;
	}
}
import { API_CONFIG } from "./config";
import { storage } from "@/shared/services/storage.service";
import { ENDPOINTS } from "./endpoints";
import {
	type DjangoErrorResponse,
	isDjangoFieldErrors,
	isDjangoDetailError,
	isDjangoNonFieldErrors,
} from "@/shared/types/backend-api.types";

export interface ApiError {
	message: string;
	status: number;
	fieldErrors?: Record<string, string[]> | undefined;
}

export class ApiClientService {
	private client: AxiosInstance;
	private onUnauthorized: (() => void) | null = null;
	private isRefreshing = false;
	private failedQueue: Array<{
		resolve: (value: any) => void;
		reject: (error: any) => void;
	}> = [];

	constructor() {
		this.client = axios.create({
			baseURL: API_CONFIG.BASE_URL,
			timeout: API_CONFIG.TIMEOUT,
			headers: { "Content-Type": "application/json" },
			withCredentials: true,
		});

		this.setupInterceptors();
	}



	private setupInterceptors(): void {
		// Add JWT token to requests
		this.client.interceptors.request.use((config) => {
			const token = storage.getAccessToken();
			if (token && !config.headers?.["X-Skip-Auth"]) {
				config.headers.Authorization = `Bearer ${token}`;
			}
			// Remove skip auth flag
			if (config.headers?.["X-Skip-Auth"]) {
				delete config.headers["X-Skip-Auth"];
			}
			return config;
		});

		// Handle 401 responses with token refresh
		this.client.interceptors.response.use(
			(response) => response,
			async (error: AxiosError) => {
				const originalRequest = error.config;

				if (
					error.response?.status === 401 &&
					originalRequest &&
					!originalRequest._retry
				) {
					console.log(
						"Received 401 response, attempting token refresh..."
					);

					// Don't try to refresh if this is already a refresh request
					if (originalRequest.url?.includes("/auth/refresh/")) {
						console.log(
							"401 on refresh endpoint, logging out user"
						);
						await this.handleUnauthorized();
						throw this.createApiError(error);
					}

					// Mark request as retried to prevent infinite loops
					originalRequest._retry = true;

					if (this.isRefreshing) {
						// If already refreshing, queue this request
						return new Promise((resolve, reject) => {
							this.failedQueue.push({ resolve, reject });
						})
							.then(() => {
								// Retry with new token
								const token = storage.getAccessToken();
								if (token) {
									originalRequest.headers.Authorization = `Bearer ${token}`;
								}
								return this.client(originalRequest);
							})
							.catch((err) => {
								throw this.createApiError(err);
							});
					}

					this.isRefreshing = true;

					try {
						const success = await this.refreshToken();

						if (success) {
							// Process queued requests
							this.processQueue(null);

							// Retry original request with new token
							const token = storage.getAccessToken();
							if (token) {
								originalRequest.headers.Authorization = `Bearer ${token}`;
							}
							return this.client(originalRequest);
						} else {
							// Refresh failed, logout user
							this.processQueue(error);
							await this.handleUnauthorized();
							throw this.createApiError(error);
						}
					} catch (refreshError) {
						this.processQueue(refreshError);
						await this.handleUnauthorized();
						throw this.createApiError(error);
					} finally {
						this.isRefreshing = false;
					}
				}

				throw this.createApiError(error);
			}
		);
	}

	private async refreshToken(): Promise<boolean> {
		try {
			const refreshToken = storage.getRefreshToken();
			if (!refreshToken) {
				console.warn("No refresh token available for refresh");
				return false;
			}

			console.log("Attempting to refresh access token...");

			// Make refresh request without going through interceptors
			const response = await axios.post<{ access: string }>(
				`${API_CONFIG.BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
				{ refresh: refreshToken },
				{
					headers: { "Content-Type": "application/json" },
					withCredentials: true,
				}
			);

			if (response.data?.access) {
				// Update stored access token, keep existing refresh token
				storage.setTokens(response.data.access, refreshToken);
				console.log("Access token refreshed successfully");
				return true;
			}

			console.warn("Refresh response did not contain access token");
			return false;
		} catch (error) {
			console.error("Token refresh failed:", error);
			return false;
		}
	}

	private processQueue(error: unknown): void {
		this.failedQueue.forEach(({ resolve, reject }) => {
			if (error) {
				reject(error);
			} else {
				resolve(null);
			}
		});

		this.failedQueue = [];
	}

	private async handleUnauthorized(): Promise<void> {
		storage.clearTokens();
		if (this.onUnauthorized) {
			this.onUnauthorized();
		}
	}

	private createApiError(error: AxiosError): ApiError {
		const status = error.response?.status || 0;
		const data = error.response?.data as DjangoErrorResponse | undefined;

		let message = "An error occurred";
		let fieldErrors: Record<string, string[]> | undefined;

		if (data) {
			if (isDjangoDetailError(data)) {
				message = data.detail;
			} else if (isDjangoNonFieldErrors(data)) {
				message = data.non_field_errors[0] ?? message;
			} else if (isDjangoFieldErrors(data)) {
				fieldErrors = {};
				const fieldMessages: string[] = [];

				Object.entries(data).forEach(([field, errors]) => {
					if (errors) {
						const errorArray = Array.isArray(errors)
							? errors
							: [errors];
						fieldErrors![field] = errorArray;
						fieldMessages.push(`${field}: ${errorArray[0]}`);
					}
				});

				if (fieldMessages.length > 0) {
					message = fieldMessages[0];
				}
			} else if (typeof data === "string") {
				message = data;
			}
		}

		return {
			message,
			status,
			fieldErrors: fieldErrors ?? undefined,
		};
	}

	// Basic HTTP methods
	async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response = await this.client.get<T>(url, config);
		return response.data;
	}

	async post<T>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> {
		const response = await this.client.post<T>(url, data, config);
		return response.data;
	}

	async put<T>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> {
		const response = await this.client.put<T>(url, data, config);
		return response.data;
	}

	async patch<T>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> {
		const response = await this.client.patch<T>(url, data, config);
		return response.data;
	}

	async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response = await this.client.delete<T>(url, config);
		return response.data;
	}

	// Blob methods for file downloads
	async getBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
		const response = await this.client.get(url, {
			...config,
			responseType: "blob",
		});
		return response.data;
	}





	// Skip auth for public endpoints
	async getPublic<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
		return this.get<T>(url, {
			...config,
			headers: { ...config?.headers, "X-Skip-Auth": "true" },
		});
	}

	async postPublic<T>(
		url: string,
		data?: unknown,
		config?: AxiosRequestConfig
	): Promise<T> {
		return this.post<T>(url, data, {
			...config,
			headers: { ...config?.headers, "X-Skip-Auth": "true" },
		});
	}

	// Configuration methods
	setUnauthorizedHandler(handler: () => void): void {
		this.onUnauthorized = handler;
	}
}

export const apiClient = new ApiClientService();
