// Authentication-related types that match Django serializers exactly
// This file contains all authentication, JWT, and user-related types

// ============================================================================
// AUTHENTICATION TYPES (JWT)
// ============================================================================

// Login request (matches Django login view)
export interface LoginCredentials {
	email: string;
	password: string;
}

// Token refresh request (matches Django JWT refresh view)
export interface TokenRefreshRequest {
	refresh: string;
}

// Token refresh response (matches Django JWT refresh response)
export interface TokenRefreshResponse {
	access: string;
}

// Logout request (matches Django logout view)
export interface LogoutRequest {
	refresh_token: string;
}

// JWT authentication response (matches UserJWTTokenSerializer)
export interface AuthResponse {
	access: string; // JWT access token
	refresh: string; // JWT refresh token
	user: User; // Complete user object with preferences
	token_type?: string; // "Bearer" (optional, defaults to Bearer)
	expires_in?: number; // Access token expiry in seconds (optional)
}

// ============================================================================
// USER TYPES (matches Django User model and serializers)
// ============================================================================

// Role choices (matches User.RoleChoices in Django)
export type UserRole = "botanist" | "finance" | "none";

// Theme choices (matches UserPreferences.ThemeChoices)
export type ThemeChoice = "light" | "dark" | "system";

// Display mode choices (matches UserPreferences.DisplayModeChoices)
export type DisplayModeChoice = "grid" | "list";

// Items per page choices (matches UserPreferences.ItemsPerPageChoices)
export type ItemsPerPageChoice = 10 | 25 | 50 | 100;

// Date format choices (matches UserPreferences.DateFormatChoices)
export type DateFormatChoice = "d/m/Y" | "m/d/Y" | "Y-m-d" | "d F Y";

// Time format choices (matches UserPreferences.TimeFormatChoices)
export type TimeFormatChoice = "g:i A" | "H:i";

// Loader style choices (matches UserPreferences.LoaderStyleChoices)
export type LoaderStyleChoice = "cook" | "base" | "minimal";

// User preferences (matches UserPreferencesSerializer)
export interface UserPreferences {
	// Theme preferences
	theme: ThemeChoice;

	// Frontend UI preferences (for cross-device sync)
	loader_style: LoaderStyleChoice;

	// Table-specific filter preferences (JSON field for data table persistence)
	table_filter_preferences: Record<string, unknown>;

	// General UI preferences (JSON field for extensibility)
	ui_preferences: Record<string, unknown>;

	// Display preferences
	submissions_display_mode: DisplayModeChoice;
	certificates_display_mode: DisplayModeChoice;

	// Pagination preferences
	items_per_page: ItemsPerPageChoice;

	// Notification preferences
	email_notifications: boolean;
	comment_notifications: boolean;
	reaction_notifications: boolean;
	notify_submission_assigned: boolean;
	notify_phase_changes: boolean;
	notify_certificate_generated: boolean;
	notify_invoices_generated: boolean;
	notify_pdfs_mailed: boolean;

	// Accessibility preferences
	reduce_motion: boolean;

	// Date/Time preferences
	date_format: DateFormatChoice;
	time_format: TimeFormatChoice;

	// Timestamp fields
	created_at: string;
	updated_at: string;

	// Computed fields from serializer
	is_dark_mode: boolean;
	css_theme_class: string;
	display_preferences: {
		submissions: DisplayModeChoice;
		certificates: DisplayModeChoice;
	};
	notification_settings: {
		email: boolean;
		comments: boolean;
		reactions: boolean;
		assigned: boolean;
		phase_changes: boolean;
		certificates: boolean;
		invoices: boolean;
		sent: boolean;
	};
}

// Complete user object (matches UserJWTObjectSerializer)
export interface User {
	// Core user fields
	id: number;
	email: string;
	first_name: string | null;
	last_name: string | null;
	full_name: string; // Computed field
	initials: string; // Computed field

	// Role information
	role: UserRole;
	role_display: string; // Computed field

	// IT Assets integration
	it_asset_id: number | null;
	employee_id: string | null;

	// Django user fields
	is_staff: boolean;
	is_active: boolean;
	is_superuser: boolean;
	date_joined: string; // ISO datetime string
	last_login: string | null; // ISO datetime string

	// Authentication status
	is_authenticated: boolean; // Always true for authenticated responses

	// Nested preferences
	preferences: UserPreferences;
}

// Basic user info (matches UserBasicSerializer)
export interface UserBasic {
	id: number;
	email: string;
	first_name: string | null;
	last_name: string | null;
	full_name: string;
	initials: string;
	role: UserRole;
	role_display: string;
	is_authenticated: boolean;
}

// Minimal user info for lists (matches UserTinySerializer)
export interface UserTiny {
	id: number;
	email: string;
	first_name: string | null;
	last_name: string | null;
	full_name: string;
	initials: string;
	role: UserRole;
	role_display: string;
	is_active: boolean;
	is_staff: boolean;
	is_superuser: boolean; // Added for role badge display consistency
	date_joined: string;
	last_login: string | null;
}

// User creation request (matches UserCreateSerializer)
export interface UserCreateRequest {
	email: string;
	first_name: string;
	last_name: string;
	role: UserRole;
	password: string;
	password_confirm: string;
	is_staff?: boolean;
	is_active?: boolean;
	it_asset_id?: number | null;
	employee_id?: string | null;
}

// User update request (partial update)
export interface UserUpdateRequest {
	email?: string;
	first_name?: string;
	last_name?: string;
	role?: UserRole;
	is_staff?: boolean;
	is_active?: boolean;
	it_asset_id?: number | null;
	employee_id?: string | null;
}

// ============================================================================
// EXTERNAL USER TYPES (for invitations from IT Assets API)
// ============================================================================

// External user from IT Assets API (matches backend ExternalUserSearchView response)
export interface ExternalUser {
	id: number;
	employee_id: string;
	given_name: string;
	surname: string;
	email: string;
	full_name: string;
	title?: string;
	division?: string;
	unit?: string;
	[key: string]: unknown; // Allow additional properties
}

// External user search response
export interface ExternalUserSearchResponse {
	results: ExternalUser[];
	message?: string;
	error?: string;
}

// User search parameters
export interface UserSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	role?: UserRole;
	is_active?: boolean;
	is_staff?: boolean;
	exclude?: number[];
	limit?: number;
	offset?: number;
}

// Forward declaration to avoid circular imports
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

// Paginated users response
export interface PaginatedUsersResponse extends PaginatedResponse<User> {}

// Users table filter preferences
export interface UsersTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	roleFilter?: string; // "all" or specific role
	statusFilter?: string; // "all", "active", "inactive"
}