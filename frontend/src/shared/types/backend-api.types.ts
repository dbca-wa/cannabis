// Backend API types that match Django serializers exactly
// This file serves as the single source of truth for API contracts
// Feature-specific types are defined in their feature modules and re-exported here

import type { CasePhase } from "@/features/cases/types/cases.types";

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
		cases: DisplayModeChoice;
		certificates: DisplayModeChoice;
	};
}

// Complete user object (matches UserJWTObjectSerializer)
export interface User {
	// Core user fields
	id: number;
	email: string;
	given_names: string | null;
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
	requires_password_change: boolean;
	date_joined: string; // ISO datetime string
	last_login: string | null; // ISO datetime string

	// Authentication status
	is_authenticated: boolean; // Always true for authenticated responses

	// Nested preferences
	preferences: UserPreferences;

	// Signature status (annotated for botanist users)
	has_signature?: boolean;

	// Cases count (annotated in list view)
	cases_count?: number;
}

// JWT authentication response (matches UserJWTTokenSerializer)
export interface AuthResponse {
	access: string; // JWT access token
	refresh: string; // JWT refresh token
	user: User; // Complete user object with preferences
	token_type?: string; // "Bearer" (optional, defaults to Bearer)
	expires_in?: number; // Access token expiry in seconds (optional)
}

// Basic user info (matches UserBasicSerializer)
export interface UserBasic {
	id: number;
	email: string;
	given_names: string | null;
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
	given_names: string | null;
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
	has_signature?: boolean; // Present for botanist users in admin views
	cases_count?: number; // Annotated in list view
}

// User creation request (matches UserCreateSerializer)
export interface UserCreateRequest {
	email: string;
	given_names: string;
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
	given_names?: string;
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

// ============================================================================
// INVITATION SYSTEM TYPES (matches Django InviteRecord model)
// ============================================================================

// Invite Record (matches InviteRecordSerializer)
export interface InviteRecord {
	id: number;
	email: string;
	invited_by: number; // User ID
	invited_by_details: UserTiny; // Nested user object
	role: UserRole;
	role_display: string;
	token: string;
	created_at: string; // ISO datetime string
	expires_at: string; // ISO datetime string
	is_valid: boolean;
	is_used: boolean;
	used_at: string | null; // ISO datetime string
	external_user_data: ExternalUser; // JSON field containing external user data
}

// Invite creation request (matches backend InviteUserView)
export interface InviteUserRequest {
	external_user_data: ExternalUser;
	role: UserRole;
	is_staff?: boolean;
	is_active?: boolean;
}

// Invite activation response (matches backend InviteActivationView)
export interface InviteActivationResponse extends AuthResponse {
	temporary_password: string;
	requires_password_change: boolean;
}

// ============================================================================
// PASSWORD MANAGEMENT TYPES
// ============================================================================

// Password validation request
export interface PasswordValidationRequest {
	password: string;
}

// Password validation response (matches backend PasswordValidator)
export interface PasswordValidationResponse {
	is_valid: boolean;
	errors: string[];
	strength_score?: number; // Optional: 1-5 scale for UI feedback
}

// Password update request
export interface PasswordUpdateRequest {
	current_password?: string; // Required for existing users, optional for first-time setup
	new_password: string;
	confirm_password: string;
}

// Password update response
export interface PasswordUpdateResponse {
	message: string;
	password_changed_at: string; // ISO datetime string
}

// Forgot password request
export interface ForgotPasswordRequest {
	email: string;
}

// Forgot password response
export interface ForgotPasswordResponse {
	message: string;
	email_sent: boolean;
}

// Password reset request (when clicking reset link)
export interface PasswordResetRequest {
	token: string;
	new_password: string;
	confirm_password: string;
}

// Password reset response
export interface PasswordResetResponse {
	message: string;
	auto_login: boolean;
	access?: string; // JWT access token if auto_login is true
	refresh?: string; // JWT refresh token if auto_login is true
	user?: User; // User object if auto_login is true
}

// ============================================================================
// PAGINATION TYPES (matches Django REST framework pagination)
// ============================================================================

// Standard Django REST framework paginated response
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

// Paginated users response
export type PaginatedUsersResponse = PaginatedResponse<User>;

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

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

// ============================================================================
// ERROR TYPES (matches Django REST framework error responses)
// ============================================================================

// Field-level validation errors
export type FieldError = string | string[];

// Django field validation errors
export interface DjangoFieldErrors {
	[fieldName: string]: FieldError;
}

// Django non-field errors (cross-field validation)
export interface DjangoNonFieldErrors {
	non_field_errors: string[];
}

// Django detail errors (simple message)
export interface DjangoDetailError {
	detail: string;
}

// Django message errors (custom message)
export interface DjangoMessageError {
	message: string;
}

// Combined Django error response
export type DjangoErrorResponse =
	| DjangoFieldErrors
	| DjangoNonFieldErrors
	| DjangoDetailError
	| DjangoMessageError
	| (DjangoFieldErrors & DjangoNonFieldErrors)
	| (DjangoFieldErrors & DjangoDetailError)
	| (DjangoFieldErrors & DjangoMessageError)
	| string; // Sometimes Django just returns a string

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isDjangoFieldErrors = (
	error: DjangoErrorResponse
): error is DjangoFieldErrors => {
	return (
		typeof error === "object" &&
		error !== null &&
		!("non_field_errors" in error) &&
		!("detail" in error) &&
		!("message" in error)
	);
};

export const isDjangoNonFieldErrors = (
	error: DjangoErrorResponse
): error is DjangoNonFieldErrors => {
	return (
		typeof error === "object" && error !== null && "non_field_errors" in error
	);
};

export const isDjangoDetailError = (
	error: DjangoErrorResponse
): error is DjangoDetailError => {
	return typeof error === "object" && error !== null && "detail" in error;
};

export const isDjangoMessageError = (
	error: DjangoErrorResponse
): error is DjangoMessageError => {
	return typeof error === "object" && error !== null && "message" in error;
};

export const isStringError = (error: DjangoErrorResponse): error is string => {
	return typeof error === "string";
};

// ============================================================================
// POLICE TYPES (re-exported from feature module)
// ============================================================================

export type {
	OfficerRank,
	PoliceStation,
	PoliceStationTiny,
	PoliceOfficer,
	PoliceOfficerTiny,
	PoliceStationCreateRequest,
	PoliceStationUpdateRequest,
	PoliceOfficerCreateRequest,
	PoliceOfficerUpdateRequest,
	PaginatedPoliceStationsResponse,
	PaginatedPoliceOfficersResponse,
	PoliceStationSearchParams,
	PoliceOfficerSearchParams,
} from "@/features/police/types/police.types";

// ============================================================================
// TABLE FILTER PREFERENCE TYPES
// ============================================================================

// Sort direction
export type SortDirection = "asc" | "desc";

// Base table filter preferences
export interface BaseTableFilterPreferences {
	sortField?: string;
	sortDirection?: SortDirection;
}

// Police Officers table filter preferences
export interface OfficersTableFilterPreferences extends BaseTableFilterPreferences {
	stationFilter?: string; // "all" or station ID as string
	rankFilter?: string; // "all" or specific rank
	swornFilter?: string; // "all", "true", "false"
	includeUnknown?: boolean;
	unknownOnly?: boolean;
}

// Police Stations table filter preferences
export type StationsTableFilterPreferences = BaseTableFilterPreferences;

// Users table filter preferences
export interface UsersTableFilterPreferences extends BaseTableFilterPreferences {
	roleFilter?: string; // "all" or specific role
	statusFilter?: string; // "all", "active", "inactive"
}

// Defendants table filter preferences
export type DefendantsTableFilterPreferences = BaseTableFilterPreferences;

// Certificates table filter preferences
export type CertificatesTableFilterPreferences = BaseTableFilterPreferences;

// Invoices table filter preferences
export type InvoicesTableFilterPreferences = BaseTableFilterPreferences;

// Combined table filter preferences
export interface TableFilterPreferences {
	officers?: OfficersTableFilterPreferences;
	stations?: StationsTableFilterPreferences;
	users?: UsersTableFilterPreferences;
	defendants?: DefendantsTableFilterPreferences;
	certificates?: CertificatesTableFilterPreferences;
	invoices?: InvoicesTableFilterPreferences;
}

// ============================================================================
// CERTIFICATE & INVOICE TYPES (re-exported from feature modules)
// ============================================================================

export type {
	Certificate,
	CertificateCreateRequest,
	PaginatedCertificatesResponse,
	CertificateSearchParams,
} from "@/features/certificates/types/certificates.types";

// ============================================================================
// DEFENDANTS TYPES (re-exported from feature module)
// ============================================================================

export type {
	Defendant,
	DefendantTiny,
	DefendantCreateRequest,
	DefendantUpdateRequest,
	PaginatedDefendantsResponse,
	DefendantSearchParams,
} from "@/features/defendants/types/defendants.types";

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Generic API response wrapper
export interface BackendApiResponse<T> {
	data: T;
	status: number;
	statusText: string;
}

// Service result wrapper (used by service layer)
export interface ServiceResult<T> {
	data: T;
	success: boolean;
	error?: string;
	metadata?: {
		requestId?: string;
		duration?: number;
		cached?: boolean;
	};
}

// Request configuration
export interface RequestConfig {
	timeout?: number;
	retries?: number;
	skipAuth?: boolean;
	skipCSRF?: boolean;
	silent?: boolean; // Don't log errors
}
// ============================================================================
// SUBMISSIONS/CASES TYPES (re-exported from feature modules)
// ============================================================================

export type {
	CasePhase,
	PhaseHistoryEntry,
	Case,
	CaseTiny,
	CaseCreateRequest,
	CaseDraft,
	CaseUpdateRequest,
	PaginatedCasesResponse,
	CaseSearchParams,
	CasesSearchParams,
	WorkflowAction,
	WorkflowActionRequest,
	WorkflowActionResponse,
	Priority3Form,
	Priority3FormTiny,
	Priority3FormCreateRequest,
	Priority3FormUpdateRequest,
	FormCertificateGenerateRequest,
	FormWorkflowRequest,
	FormWorkflowResponse,
} from "@/features/cases/types/cases.types";

export type {
	DrugBagContentType,
	BotanicalDetermination,
	DeterminationType,
	DrugBag,
	DrugBagCreateRequest,
	DrugBagUpdateRequest,
	PaginatedDrugBagsResponse,
} from "@/features/cases/types/drugBags.types";

export type {
	BotanicalAssessment,
	BotanicalAssessmentRequest,
} from "@/features/cases/types/assessments.types";

// ============================================================================
// DASHBOARD TYPES (matches dashboard API endpoints)
// ============================================================================

// User role in case (for dashboard my cases)
export type UserRoleInCase = "botanist" | "finance" | "admin";

// Dashboard user case (matches dashboard my cases endpoint)
export interface DashboardUserCase {
	id: number;
	case_number: string;
	phase: CasePhase;
	phase_display: string;
	received: string; // ISO datetime string
	role_in_submission: UserRoleInCase;
}

// Dashboard user cases response (matches GET /cases/my/)
export interface DashboardUserCasesResponse {
	results: DashboardUserCase[];
	count: number;
}

// Statistics period data (shared structure for both certificate and revenue stats)
export interface StatisticsPeriodData {
	count?: number; // For certificate statistics
	total?: number; // For revenue statistics (as number, not string)
	month: string;
	year: number;
}

// Statistics comparison data (shared structure for month-over-month and year-over-year)
export interface StatisticsComparisonData {
	count?: number; // For certificate statistics
	total?: number; // For revenue statistics (as number, not string)
	change_percentage: number;
}

// Certificate statistics response (matches GET /cases/stats/certificates/)
export interface CertificateStatisticsResponse {
	current_month: StatisticsPeriodData;
	previous_month: StatisticsComparisonData | null;
	previous_year_same_month: StatisticsComparisonData | null;
}

// Revenue statistics response (matches GET /cases/stats/revenue/)
export interface RevenueStatisticsResponse {
	financial_year: { total: number; label: string };
	previous_year: { total: number; change_percentage: number | null } | null;
}

// ============================================================================
// TABLE FILTER PREFERENCES (for server-side persistence)
// ============================================================================

// Cases table filter preferences
export interface CasesTableFilterPreferences {
	searchQuery?: string;
	phase?: CasePhase | "all";
	botanist?: number | "all";
	officer?: number | "all";
	station?: number | "all";
	dateFrom?: string;
	dateTo?: string;
	sortField?: string;
	sortDirection?: "asc" | "desc";
}

// Update the main TableFilterMap to include cases, certificates, and invoices
export interface TableFilterMap {
	users: UsersTableFilterPreferences;
	"police-officers": OfficersTableFilterPreferences;
	"police-stations": StationsTableFilterPreferences;
	defendants: DefendantsTableFilterPreferences;
	cases: CasesTableFilterPreferences;
	certificates: CertificatesTableFilterPreferences;
	invoices: InvoicesTableFilterPreferences;
}

// ============================================================================
// SYSTEM SETTINGS (for pricing configuration)
// ============================================================================

export interface SystemSettings {
	cost_per_certificate: string; // DecimalField as string
	cost_per_bag: string;
	tax_percentage: string;
	ocr_enabled: boolean;
	forward_certificate_emails_to: string;
	send_emails_to_self: boolean;
	environment: string;
	send_emails_to_self_editable: boolean;
	last_modified_by?: {
		id: number;
		email: string;
		given_names: string;
		last_name: string;
	} | null;
	last_modified_at?: string | null; // ISO datetime string
}

// Lightweight feature flags readable by any app user (GET /system/feature-flags)
export interface FeatureFlags {
	ocr_enabled: boolean;
}
// ============================================================================
// DASHBOARD TYPES (for dashboard-specific API responses)
// ============================================================================

// Pending attention case (matches PendingAttentionSerializer)
export interface PendingAttentionCase {
	id: number;
	case_number: string;
	phase: CasePhase;
	phase_display: string;
	received: string; // ISO datetime string
	approved_botanist_name: string | null;
	finance_officer_name: string | null;
	bags_count: number;
}

// Dashboard case (matches MyCasesView response)
export interface DashboardCase {
	id: number;
	case_number: string;
	phase: CasePhase;
	phase_display: string;
	received: string; // ISO datetime string
	role_in_submission: "botanist" | "finance" | "admin" | "user";
}

// Dashboard cases response (matches MyCasesView)
export interface DashboardCasesResponse {
	results: DashboardCase[];
	count: number;
}

// Monthly data for statistics (used in both certificate and revenue stats)
export interface DashboardMonthlyData {
	count?: number; // For certificates
	total?: number; // For revenue
	month: string;
	year: number;
}

// Comparison data for statistics (month-over-month and year-over-year)
export interface DashboardComparisonData {
	count?: number; // For certificates
	total?: number; // For revenue
	change_percentage: number | null;
}

// Certificate statistics response (matches CertificateStatsView)
export interface DashboardCertificateStats {
	current_month: DashboardMonthlyData;
	previous_month: DashboardComparisonData | null;
	previous_year_same_month: DashboardComparisonData | null;
}

// Revenue statistics response (matches RevenueStatsView)
export interface DashboardRevenueStats {
	current_month: DashboardMonthlyData;
	previous_month: DashboardComparisonData | null;
	previous_year_same_month: DashboardComparisonData | null;
}
