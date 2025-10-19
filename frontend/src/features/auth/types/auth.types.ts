import type { User, LoginCredentials } from "@/shared/types/backend-api.types";

// Registration request payload (frontend-specific)
export interface RegisterData {
	email: string;
	// password will be generated/sent via email in django
}

// Auth state for stores
export interface AuthState {
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
}

// Auth context type for providers
export interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (credentials: LoginCredentials) => Promise<boolean>;
	logout: () => Promise<void>;
	refreshToken: () => Promise<boolean>;
	clearError: () => void;
	error: string | null;
}

export type { User, LoginCredentials };
