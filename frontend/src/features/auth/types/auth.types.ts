import type { 
	User, 
	LoginCredentials,
	PasswordValidationResponse,
	PasswordUpdateRequest,
	PasswordUpdateResponse,
	ForgotPasswordRequest,
	ForgotPasswordResponse,
	InviteActivationResponse,
} from "@/shared/types/backend-api.types";

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

// Password validation hook result
export interface PasswordValidationHookResult {
	isValid: boolean;
	errors: string[];
	isValidating: boolean;
	validatePassword: (password: string) => Promise<void>;
	clearValidation: () => void;
}

// Re-export types for convenience
export type { 
	User, 
	LoginCredentials,
	PasswordValidationResponse,
	PasswordUpdateRequest,
	PasswordUpdateResponse,
	ForgotPasswordRequest,
	ForgotPasswordResponse,
	InviteActivationResponse,
};
