import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { storage } from "@/shared/services/storage.service";
import { generateRequestId } from "@/shared/utils/uuid";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	AuthResponse,
	ServiceResult,
	User,
} from "@/shared/types/backend-api.types";
import type { LoginCredentials, RegisterData } from "../types/auth.types";

class AuthService {
	private userCache: { user: User; timestamp: number } | null = null;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	async login(
		credentials: LoginCredentials
	): Promise<ServiceResult<AuthResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Attempting JWT login", {
			email: credentials.email,
			requestId,
		});

		try {
			const response = await apiClient.post<AuthResponse>(
				ENDPOINTS.AUTH.LOGIN,
				credentials
			);

			if (
				!response ||
				!response.user ||
				!response.access ||
				!response.refresh
			) {
				throw new Error(
					"Invalid JWT response structure from login API"
				);
			}

			// Store JWT tokens
			storage.setTokens(response.access, response.refresh);

			// Cache user data
			this.setCachedUser(response.user);

			// Load user preferences after successful login
			try {
				const { PreferencesSyncService } = await import(
					"@/shared/services/preferencesSync.service"
				);
				const preferences =
					await PreferencesSyncService.loadPreferencesOnLogin();

				if (preferences) {
					// Enable server sync and load preferences into UI store
					const { rootStore } = await import(
						"@/app/stores/root.store"
					);

					rootStore.uiStore.loadFromServerPreferences(preferences);

					// Add a small delay and force theme reapplication to ensure it sticks
					setTimeout(() => {
						rootStore.uiStore.applyTheme();
					}, 200);

					logger.info("User preferences loaded and synced", {
						theme: preferences.theme,
						loader: preferences.loader_style,
					});
				}
			} catch (error) {
				logger.error("Failed to load user preferences on login", {
					error,
				});
				// Don't fail login if preferences fail to load
			}

			logger.info("JWT login successful", {
				userId: response.user.id,
				email: response.user.email,
				tokenType: response.token_type,
				expiresIn: response.expires_in,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Clear any existing tokens on login failure
			storage.clearTokens();
			this.clearCache();

			logger.error("JWT login failed", {
				email: credentials.email,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as AuthResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async logout(): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Attempting JWT logout", { requestId });

		try {
			const refreshToken = storage.getRefreshToken();

			if (refreshToken) {
				// Call backend to blacklist refresh token
				await apiClient.post(ENDPOINTS.AUTH.LOGOUT, {
					refresh_token: refreshToken,
				});
			}

			// Clear tokens and cache regardless of API result
			storage.clearTokens();
			this.clearCache();

			// Clear preferences on logout
			try {
				const { rootStore } = await import("@/app/stores/root.store");
				rootStore.uiStore.reset(); // Clear all UI preferences

				// Clear preferences from TanStack Query cache
				const { userPreferencesQueryKeys } = await import(
					"@/features/user/hooks/useUserPreferences"
				);
				const { queryClient } = await import(
					"@/app/providers/query.provider"
				);
				queryClient.removeQueries({
					queryKey: userPreferencesQueryKeys.all,
				});

				logger.info("Preferences cleared on logout");
			} catch (error) {
				logger.error("Failed to clear preferences on logout", {
					error,
				});
			}

			logger.info("JWT logout successful", { requestId });

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.warn(
				"JWT logout request failed (but clearing tokens anyway)",
				{
					message: normalizedError.message,
					requestId,
				}
			);

			// Clear tokens even if logout request failed
			storage.clearTokens();
			this.clearCache();

			// Clear preferences even if logout request failed
			try {
				const { rootStore } = await import("@/app/stores/root.store");
				rootStore.uiStore.reset(); // Clear all UI preferences

				// Clear preferences from TanStack Query cache
				const { userPreferencesQueryKeys } = await import(
					"@/features/user/hooks/useUserPreferences"
				);
				const { queryClient } = await import(
					"@/app/providers/query.provider"
				);
				queryClient.removeQueries({
					queryKey: userPreferencesQueryKeys.all,
				});

				logger.info("Preferences cleared on logout (after error)");
			} catch (error) {
				logger.error(
					"Failed to clear preferences on logout (after error)",
					{ error }
				);
			}

			return {
				data: undefined,
				success: true,
			};
		}
	}

	async getCurrentUser(): Promise<ServiceResult<User>> {
		const requestId = this.generateRequestId();
		logger.debug("Fetching current user via JWT", { requestId });

		try {
			// Check if we have valid tokens first
			if (!this.hasValidTokens()) {
				return {
					data: {} as User,
					success: false,
					error: "No valid authentication tokens found",
				};
			}

			// Check cache first
			const cachedUser = this.getCachedUser();
			if (cachedUser) {
				logger.debug("Returning cached user", {
					userId: cachedUser.id,
					email: cachedUser.email,
					requestId,
				});

				return {
					data: cachedUser,
					success: true,
				};
			}

			// Fetch from API with JWT token
			const user = await apiClient.get<User>(ENDPOINTS.AUTH.ME);

			if (!user || !user.id) {
				throw new Error("Invalid user data received from API");
			}

			// Cache the result
			this.setCachedUser(user);

			logger.debug("Current user fetched via JWT", {
				userId: user.id,
				email: user.email,
				requestId,
			});

			return {
				data: user,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			// Clear cache and tokens on auth errors
			if (
				Number(normalizedError.code) === 401 ||
				Number(normalizedError.code) === 403
			) {
				this.clearCache();
				storage.clearTokens();
			}

			logger.error("Failed to fetch current user", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as User,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async refreshToken(): Promise<ServiceResult<{ access: string }>> {
		const requestId = this.generateRequestId();
		logger.debug("Attempting JWT token refresh", { requestId });

		try {
			const refreshToken = storage.getRefreshToken();
			if (!refreshToken) {
				return {
					data: {} as { access: string },
					success: false,
					error: "No refresh token available",
				};
			}

			const response = await apiClient.post<{ access: string }>(
				ENDPOINTS.AUTH.REFRESH,
				{ refresh: refreshToken }
			);

			if (!response.access) {
				throw new Error("Invalid refresh response structure");
			}

			// Update stored access token, keep existing refresh token
			storage.setTokens(response.access, refreshToken);

			logger.debug("JWT token refreshed successfully", { requestId });

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("JWT token refresh failed", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});

			// If refresh fails, clear all tokens
			storage.clearTokens();
			this.clearCache();

			return {
				data: {} as { access: string },
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async register(data: RegisterData): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Attempting user registration", {
			email: data.email,
			requestId,
		});

		try {
			await apiClient.post(ENDPOINTS.USERS.CREATE, data);

			logger.info("User registration successful", {
				email: data.email,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("User registration failed", {
				email: data.email,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
			});

			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	// JWT-specific methods
	hasValidTokens(): boolean {
		return storage.hasValidTokens();
	}

	shouldRefreshToken(): boolean {
		return storage.shouldRefreshToken();
	}

	getAccessToken(): string | null {
		return storage.getAccessToken();
	}

	// Cache management (for performance, not auth state)
	private getCachedUser(): User | null {
		if (!this.userCache) return null;

		const now = Date.now();
		if (now - this.userCache.timestamp > this.CACHE_DURATION) {
			this.userCache = null;
			return null;
		}

		return this.userCache.user;
	}

	private setCachedUser(user: User): void {
		if (user && user.id) {
			this.userCache = {
				user,
				timestamp: Date.now(),
			};
		}
	}

	public clearCache(): void {
		this.userCache = null;
		logger.debug("Auth service cache cleared");
	}

	private generateRequestId(): string {
		return generateRequestId("auth");
	}

	public getDebugInfo() {
		return {
			hasValidTokens: this.hasValidTokens(),
			shouldRefresh: this.shouldRefreshToken(),
			hasCache: !!this.userCache,
			cacheAge: this.userCache
				? Date.now() - this.userCache.timestamp
				: null,
			cachedUserId: this.userCache?.user?.id || null,
			cachedEmail: this.userCache?.user?.email || null,
			accessToken: this.getAccessToken() ? "present" : "missing",
			refreshToken: storage.getRefreshToken()
				? "present"
				: "missing",
		};
	}
}

// Export singleton instance
export const authService = new AuthService();
