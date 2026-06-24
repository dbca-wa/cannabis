import { storage } from "@/shared/services/storage.service";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	AuthResponse,
	User,
	InviteActivationResponse,
	PasswordValidationResponse,
	PasswordUpdateRequest,
	PasswordUpdateResponse,
	ForgotPasswordResponse,
} from "@/shared/types/backend-api.types";
import type { LoginCredentials, RegisterData } from "../types/auth.types";

// Module-level cache for user data (singleton state)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let userCache: { user: User; timestamp: number } | null = null;

const getCachedUser = (): User | null => {
	if (!userCache) return null;
	if (Date.now() - userCache.timestamp > CACHE_DURATION) {
		userCache = null;
		return null;
	}
	return userCache.user;
};

export const setCachedUser = (user: User): void => {
	if (user && user.id) {
		userCache = { user, timestamp: Date.now() };
	}
};

export const clearCache = (): void => {
	userCache = null;
};

/**
 * Authenticate user with email/password credentials.
 * Stores JWT tokens and caches user data on success.
 */
export const login = async (
	credentials: LoginCredentials
): Promise<AuthResponse> => {
	const response = await apiClient.post<AuthResponse>(
		ENDPOINTS.AUTH.LOGIN,
		credentials
	);

	if (!response || !response.user || !response.access || !response.refresh) {
		throw new Error("Invalid JWT response structure from login API");
	}

	// Store JWT tokens
	storage.setTokens(response.access, response.refresh);
	setCachedUser(response.user);

	// Load user preferences after successful login
	try {
		const { PreferencesSyncService } =
			await import("@/shared/services/preferencesSync.service");
		const preferences = await PreferencesSyncService.loadPreferencesOnLogin();

		if (preferences) {
			const { rootStore } = await import("@/app/stores/root.store");
			rootStore.uiStore.loadFromServerPreferences(preferences);
			setTimeout(() => {
				rootStore.uiStore.applyTheme();
			}, 200);
		}
	} catch {
		// Don't fail login if preferences fail to load
	}

	return response;
};

/**
 * Log out the current user. Blacklists the refresh token server-side.
 */
export const logout = async (): Promise<void> => {
	try {
		const refreshToken = storage.getRefreshToken();
		if (refreshToken) {
			await apiClient.post(ENDPOINTS.AUTH.LOGOUT, {
				refresh_token: refreshToken,
			});
		}
	} catch {
		// Continue cleanup even if server logout fails
	}

	storage.clearTokens();
	clearCache();

	try {
		const { rootStore } = await import("@/app/stores/root.store");
		rootStore.uiStore.reset();
	} catch {
		// Don't fail logout if preference clearing fails
	}
};

/**
 * Get the currently authenticated user. Returns cached value if fresh.
 */
export const getCurrentUser = async (): Promise<User> => {
	if (!hasValidTokens()) {
		throw new Error("No valid authentication tokens found");
	}

	const cached = getCachedUser();
	if (cached) return cached;

	const user = await apiClient.get<User>(ENDPOINTS.AUTH.ME);

	if (!user || !user.id) {
		throw new Error("Invalid user data received from API");
	}

	setCachedUser(user);
	return user;
};

/**
 * Refresh the access token using the stored refresh token.
 * Stores the rotated refresh token if the server provides one.
 */
export const refreshToken = async (): Promise<{ access: string }> => {
	const refresh = storage.getRefreshToken();
	if (!refresh) {
		throw new Error("No refresh token available");
	}

	const response = await apiClient.postPublic<{
		access: string;
		refresh?: string;
	}>(ENDPOINTS.AUTH.REFRESH, { refresh });

	if (!response.access) {
		throw new Error("Invalid refresh response structure");
	}

	// Store the new access token and rotated refresh token (if provided)
	const newRefreshToken = response.refresh || refresh;
	storage.setTokens(response.access, newRefreshToken);
	return response;
};

/**
 * Register a new user account.
 */
export const register = async (data: RegisterData): Promise<void> => {
	await apiClient.post(ENDPOINTS.USERS.CREATE, data);
};

/**
 * Activate a user invitation by token. Stores tokens and caches user.
 */
export const activateInvitation = async (
	token: string
): Promise<InviteActivationResponse> => {
	const response = await apiClient.get<InviteActivationResponse>(
		ENDPOINTS.AUTH.ACTIVATE_INVITE(token)
	);

	if (!response || !response.user || !response.access || !response.refresh) {
		throw new Error("Invalid activation response structure from API");
	}

	storage.setTokens(response.access, response.refresh);
	setCachedUser(response.user);
	return response;
};

/**
 * @deprecated Use passwordService.validatePassword() instead
 */
export const validatePassword = async (
	password: string
): Promise<PasswordValidationResponse> => {
	const { validatePassword: validate } = await import("./password.service");
	return validate(password);
};

/**
 * @deprecated Use passwordService.updatePassword() instead
 */
export const updatePassword = async (
	data: PasswordUpdateRequest
): Promise<PasswordUpdateResponse> => {
	const { updatePassword: update } = await import("./password.service");
	return update(data);
};

/**
 * @deprecated Use passwordService.forgotPassword() instead
 */
export const forgotPassword = async (
	email: string
): Promise<ForgotPasswordResponse> => {
	const { forgotPassword: forgot } = await import("./password.service");
	return forgot(email);
};

// Token state helpers
export const hasValidTokens = (): boolean => storage.hasValidTokens();
export const shouldRefreshToken = (): boolean => storage.shouldRefreshToken();
export const getAccessToken = (): string | null => storage.getAccessToken();

/**
 * Debug info for development troubleshooting.
 */
export const getDebugInfo = () => ({
	hasValidTokens: hasValidTokens(),
	shouldRefresh: shouldRefreshToken(),
	hasCache: !!userCache,
	cacheAge: userCache ? Date.now() - userCache.timestamp : null,
	cachedUserId: userCache?.user?.id || null,
	cachedEmail: userCache?.user?.email || null,
	accessToken: getAccessToken() ? "present" : "missing",
	refreshToken: storage.getRefreshToken() ? "present" : "missing",
});
