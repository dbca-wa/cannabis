// Backend API types that match Django serializers exactly
// This file serves as the single source of truth for API contracts

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
export interface PaginatedUsersResponse extends PaginatedResponse<User> {}

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
		typeof error === "object" &&
		error !== null &&
		"non_field_errors" in error
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
// POLICE TYPES (matches Django PoliceStation and PoliceOfficer models)
// ============================================================================

// Officer rank choices (matches PoliceOfficer.SeniorityChoices in Django)
export type OfficerRank =
	| "unknown"
	| "unsworn_officer"
	| "sworn_officer"
	| "constable"
	| "police_constable"
	| "first_class_constable"
	| "senior_constable"
	| "detective"
	| "detective_first_class_constable"
	| "detective_senior_constable"
	| "senior_detective"
	| "sergeant"
	| "inspector"
	| "other";

// Police Station (matches PoliceStationSerializer)
export interface PoliceStation {
	id: number;
	name: string;
	address: string | null;
	phone: string | null;
	officer_count: number; // Computed field from serializer
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Police Station (matches PoliceStationTinySerializer)
export interface PoliceStationTiny {
	id: number;
	name: string;
	phone: string | null;
}

// Police Officer (matches PoliceOfficerSerializer)
export interface PoliceOfficer {
	id: number;
	badge_number: string | null;
	first_name: string | null;
	last_name: string | null;
	full_name: string; // Computed field
	rank: OfficerRank;
	rank_display: string; // Computed field from get_rank_display()
	is_sworn: boolean; // Computed field
	station: number | null; // Foreign key ID
	station_details: PoliceStationTiny | null; // Nested object
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Police Officer (matches PoliceOfficerTinySerializer)
export interface PoliceOfficerTiny {
	id: number;
	badge_number: string | null;
	first_name: string | null; // Added for form pre-selection
	last_name: string | null; // Added for form pre-selection
	full_name: string;
	rank: OfficerRank; // Added rank field for form pre-selection
	rank_display: string;
	station: number | null; // Added station ID for form pre-selection
	station_name: string | null;
	is_sworn: boolean;
}

// Police Station creation request (matches PoliceStationSerializer fields)
export interface PoliceStationCreateRequest {
	name: string;
	address?: string | null;
	phone?: string | null;
}

// Police Station update request (partial update)
export interface PoliceStationUpdateRequest {
	name?: string;
	address?: string | null;
	phone?: string | null;
}

// Police Officer creation request (matches PoliceOfficerCreateSerializer)
export interface PoliceOfficerCreateRequest {
	badge_number?: string | undefined;
	first_name?: string | undefined;
	last_name: string;
	rank: OfficerRank;
	station?: number | undefined;
}

// Police Officer update request (partial update)
export interface PoliceOfficerUpdateRequest {
	badge_number?: string | undefined;
	first_name?: string | undefined;
	last_name?: string;
	rank?: OfficerRank;
	station?: number | undefined;
}

// Paginated police responses
export interface PaginatedPoliceStationsResponse
	extends PaginatedResponse<PoliceStation> {}
export type PaginatedPoliceOfficersResponse =
	PaginatedResponse<PoliceOfficerTiny>;

// Police search parameters
export interface PoliceStationSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	limit?: number;
	offset?: number;
}

export interface PoliceOfficerSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	station?: number; // Filter by station ID
	rank?: OfficerRank; // Filter by rank
	is_sworn?: boolean; // Filter by sworn status
	include_unknown?: boolean; // Include unknown/other ranks
	unknown_only?: boolean; // Show ONLY unknown/other ranks (for data quality review)
	ordering?: string; // Sort order (e.g., 'name', '-rank', 'station')
	limit?: number;
	offset?: number;
}

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
export interface OfficersTableFilterPreferences
	extends BaseTableFilterPreferences {
	stationFilter?: string; // "all" or station ID as string
	rankFilter?: string; // "all" or specific rank
	swornFilter?: string; // "all", "true", "false"
	includeUnknown?: boolean;
	unknownOnly?: boolean;
}

// Police Stations table filter preferences
export interface StationsTableFilterPreferences
	extends BaseTableFilterPreferences {
	// Currently only has sorting, but can be extended
}

// Users table filter preferences
export interface UsersTableFilterPreferences
	extends BaseTableFilterPreferences {
	roleFilter?: string; // "all" or specific role
	statusFilter?: string; // "all", "active", "inactive"
}

// Defendants table filter preferences
export interface DefendantsTableFilterPreferences
	extends BaseTableFilterPreferences {
	// Currently only has sorting, but can be extended for case count filters
}

// Certificates table filter preferences
export interface CertificatesTableFilterPreferences
	extends BaseTableFilterPreferences {
	// Can be extended for status filters, date range filters, etc.
}

// Invoices table filter preferences
export interface InvoicesTableFilterPreferences
	extends BaseTableFilterPreferences {
	// Can be extended for status filters, amount range filters, etc.
}

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
// CERTIFICATE & INVOICE TYPES (matches Django Certificate and Invoice models)
// ============================================================================

// Certificate (matches CertificateSerializer)
export interface Certificate {
	id: number;
	certificate_number: string; // Auto-generated (e.g., CRT2024-001)
	submission?: number; // Submission ID (optional for context)
	pdf_generating: boolean;
	pdf_file: string | null; // File path
	pdf_url: string | null; // Full URL from serializer method
	pdf_size: number; // Size in bytes
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Additional Invoice Fee (matches AdditionalInvoiceFeeSerializer)
export type InvoiceFeeType = "fuel" | "call_out" | "forensic";

export interface AdditionalInvoiceFee {
	id: number;
	invoice?: number; // Invoice ID (optional for creation)
	claim_kind: InvoiceFeeType;
	claim_kind_display: string;
	units: number; // km for fuel, hours for forensic, times for call out
	description: string | null;
	calculated_cost: string; // Decimal as string
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Invoice (matches InvoiceSerializer)
export interface Invoice {
	id: number;
	invoice_number: string; // Auto-generated (e.g., INV2024-001)
	submission?: number; // Submission ID (optional for context)
	customer_number: string;
	subtotal: string; // Decimal as string
	tax_amount: string; // Decimal as string
	total: string; // Decimal as string
	pdf_generating: boolean;
	pdf_file: string | null; // File path
	pdf_url: string | null; // Full URL from serializer method
	pdf_size: number; // Size in bytes
	additional_fees?: AdditionalInvoiceFee[]; // Related fees
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Certificate creation request
export interface CertificateCreateRequest {
	submission: number; // Submission ID
}

// Invoice creation request
export interface InvoiceCreateRequest {
	submission: number; // Submission ID
	customer_number: string;
}

// Paginated certificate response
export interface PaginatedCertificatesResponse
	extends PaginatedResponse<Certificate> {}

// Paginated invoice response
export interface PaginatedInvoicesResponse extends PaginatedResponse<Invoice> {}

// Certificate search parameters
export interface CertificateSearchParams {
	search?: string; // Search by certificate number or case number
	submission?: number; // Filter by submission ID
	ordering?: string; // Sort order (e.g., '-created_at', 'certificate_number')
	limit?: number;
	offset?: number;
}

// Invoice search parameters
export interface InvoiceSearchParams {
	search?: string; // Search by invoice number or customer number
	submission?: number; // Filter by submission ID
	ordering?: string; // Sort order (e.g., '-created_at', 'invoice_number')
	limit?: number;
	offset?: number;
}

// ============================================================================
// DEFENDANTS TYPES (matches Django Defendant model and serializers)
// ============================================================================

// Complete defendant object (matches DefendantSerializer)
export interface Defendant {
	id: number;
	first_name: string | null;
	last_name: string;
	full_name: string; // Computed field
	pdf_name: string; // Computed field
	cases_count: number; // Computed field from serializer
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight defendant (matches DefendantTinySerializer)
export interface DefendantTiny {
	id: number;
	first_name: string | null;
	last_name: string;
	full_name: string; // Computed field
	cases_count: number; // Computed field from serializer
}

// Defendant creation request (matches DefendantSerializer fields)
export interface DefendantCreateRequest {
	first_name?: string | null;
	last_name: string;
}

// Defendant update request (partial update)
export interface DefendantUpdateRequest {
	first_name?: string | null;
	last_name?: string;
}

// Paginated defendants response
export interface PaginatedDefendantsResponse
	extends PaginatedResponse<DefendantTiny> {}

// Defendant search parameters
export interface DefendantSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	ordering?: string; // Sort order (e.g., 'last_name', '-cases_count')
	limit?: number;
	offset?: number;
}

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
// SUBMISSIONS TYPES (matches Django Submission, DrugBag, and BotanicalAssessment models)
// ============================================================================

// Submission phase choices (matches Submission.PhaseChoices in Django)
// NEW 6-PHASE WORKFLOW (updated from 8 phases)
export type SubmissionPhase =
	| "data_entry"
	| "finance_approval"
	| "botanist_review"
	| "documents"
	| "send_emails"
	| "complete";

// Phase history entry (matches SubmissionPhaseHistorySerializer)
export interface PhaseHistoryEntry {
	id: number;
	from_phase: SubmissionPhase;
	from_phase_display: string; // Human-readable display name
	to_phase: SubmissionPhase;
	to_phase_display: string; // Human-readable display name
	action: "advance" | "send_back";
	action_display: string; // Human-readable display name
	user: number | null; // User ID who performed the action
	user_details: UserTiny | null; // Nested user object
	reason: string | null; // Reason for send-back actions (null for advances)
	timestamp: string; // ISO datetime string
	created_at: string; // ISO datetime string
}

// Send-back request (for POST /api/v1/submissions/{id}/send-back/)
export interface SendBackRequest {
	target_phase: SubmissionPhase;
	reason: string;
}

// Send-back response
export interface SendBackResponse {
	message: string;
	new_phase: SubmissionPhase;
	sent_back_by: string;
	sent_back_at: string; // ISO datetime string
	reason: string;
}

// Drug bag content type choices (matches DrugBag.ContentType in Django)
export type DrugBagContentType =
	| "plant"
	| "plant_material"
	| "cutting"
	| "stalk"
	| "stem"
	| "seed"
	| "seed_material"
	| "unknown_seed"
	| "seedling"
	| "head"
	| "rootball"
	| "poppy"
	| "poppy_plant"
	| "poppy_capsule"
	| "poppy_head"
	| "poppy_seed"
	| "mushroom"
	| "tablet"
	| "unknown"
	| "unsure";

// Botanical assessment determination choices (matches BotanicalAssessment.DeterminationChoices)
export type BotanicalDetermination =
	| "pending"
	| "cannabis_sativa"
	| "cannabis_indica"
	| "cannabis_hybrid"
	| "mixed"
	| "papaver_somniferum"
	| "degraded"
	| "not_cannabis"
	| "unidentifiable"
	| "inconclusive";

// Botanical Assessment (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessment {
	id: number;
	determination: BotanicalDetermination | null;
	determination_display: string; // Computed field from get_determination_display()
	is_cannabis: boolean; // Computed property
	assessment_date: string | null; // ISO datetime string
	botanist_notes: string | null;
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Drug Bag (matches DrugBagSerializer)
export interface DrugBag {
	id: number;
	content_type: DrugBagContentType;
	content_type_display: string; // Computed field from get_content_type_display()
	seal_tag_numbers: string;
	new_seal_tag_numbers: string | null;
	property_reference: string | null;
	gross_weight: string | null; // DecimalField as string
	net_weight: string | null; // DecimalField as string
	security_movement_envelope: string; // Computed property from submission
	assessment: BotanicalAssessment | null; // Nested assessment
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Complete Submission (matches SubmissionSerializer)
export interface Submission {
	id: number;
	case_number: string;
	received: string; // ISO datetime string
	phase: SubmissionPhase;
	phase_display: string; // Computed field from get_phase_display()
	security_movement_envelope: string;
	internal_comments: string | null;
	is_draft: boolean; // Whether this is a draft submission

	// Finance fields (for invoice calculation)
	forensic_hours: string | null; // DecimalField as string
	fuel_distance_km: string | null; // DecimalField as string

	// Staff assignments (foreign key IDs)
	approved_botanist: number | null;
	finance_officer: number | null;
	requesting_officer: number | null;
	submitting_officer: number | null;
	station: number | null;

	// Staff assignment details (nested objects)
	approved_botanist_details: UserTiny | null;
	finance_officer_details: UserTiny | null;
	requesting_officer_details: PoliceOfficerTiny | null;
	submitting_officer_details: PoliceOfficerTiny | null;
	station_details: PoliceStationTiny | null;

	// Defendants (many-to-many)
	defendants: number[]; // Array of defendant IDs
	defendants_details: DefendantTiny[]; // Array of nested defendant objects

	// Related objects
	bags: DrugBag[];
	certificates: Certificate[];
	invoices: Invoice[];
	additional_fees: AdditionalInvoiceFee[];

	// Phase history (audit trail of all phase transitions)
	phase_history: PhaseHistoryEntry[];

	// Computed properties
	cannabis_present: boolean;
	bags_received: number;
	total_plants: number;

	// Workflow timestamps
	finance_approved_at: string | null; // ISO datetime string
	botanist_approved_at: string | null; // ISO datetime string
	documents_generated_at: string | null; // ISO datetime string (renamed from certificates_generated_at)
	emails_sent_at: string | null; // ISO datetime string
	completed_at: string | null; // ISO datetime string

	// Audit fields
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Submission for lists (matches SubmissionListSerializer)
export interface SubmissionTiny {
	id: number;
	case_number: string;
	phase: SubmissionPhase;
	phase_display: string;
	received: string; // ISO datetime string
	approved_botanist_name: string | null;
	finance_officer_name: string | null;
	requesting_officer_name: string | null;
	bags_count: number; // Computed field
	defendants_count: number; // Computed field
	cannabis_present: boolean; // Computed property
	created_at: string; // ISO datetime string
}

// Submission creation request (matches SubmissionCreateSerializer)
export interface SubmissionCreateRequest {
	case_number: string;
	received: string; // ISO datetime string
	security_movement_envelope: string;
	requesting_officer?: number | null;
	submitting_officer?: number | null;
	defendants?: number[]; // Array of defendant IDs
	is_draft?: boolean; // Whether this is a draft submission (defaults to true)
}

// Submission update request (matches SubmissionUpdateSerializer)
export interface SubmissionUpdateRequest {
	approved_botanist?: number | null;
	finance_officer?: number | null;
	internal_comments?: string | null;
	defendants?: number[]; // Array of defendant IDs
	phase?: SubmissionPhase;
}

// Drug bag creation request (matches DrugBagCreateSerializer)
export interface DrugBagCreateRequest {
	submission: number;
	content_type: DrugBagContentType;
	seal_tag_numbers: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null; // DecimalField as string
	net_weight?: string | null; // DecimalField as string
}

// Drug bag update request (partial update)
export interface DrugBagUpdateRequest {
	content_type?: DrugBagContentType;
	seal_tag_numbers?: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null; // DecimalField as string
	net_weight?: string | null; // DecimalField as string
}

// Botanical assessment creation/update request (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessmentRequest {
	determination?: BotanicalDetermination | null;
	assessment_date?: string | null; // ISO datetime string
	botanist_notes?: string | null;
}

// Paginated submissions response
export interface PaginatedSubmissionsResponse
	extends PaginatedResponse<SubmissionTiny> {}

// Paginated drug bags response
export interface PaginatedDrugBagsResponse extends PaginatedResponse<DrugBag> {}

// Submissions search parameters
export interface SubmissionsSearchParams {
	search?: string; // Search case number, officer names, defendant names
	phase?: SubmissionPhase; // Filter by workflow phase
	botanist?: number; // Filter by assigned botanist ID
	finance?: number; // Filter by assigned finance officer ID
	cannabis_only?: boolean; // Show only submissions with cannabis present
	date_from?: string; // Filter by received date (from) - ISO date string
	date_to?: string; // Filter by received date (to) - ISO date string
	full?: boolean; // Return full serializer instead of list serializer
	limit?: number;
	offset?: number;
	ordering?: string; // Sort field (e.g., "-received", "case_number")
}

// Workflow action request
export interface WorkflowActionRequest {
	action: "advance_phase" | "generate_certificate" | "generate_invoice";
	customer_number?: string; // Required for generate_invoice action
}

// Workflow action response
export interface WorkflowActionResponse {
	message: string;
	new_phase?: SubmissionPhase;
	certificate_number?: string;
	invoice_number?: string;
	total?: string;
}

// ============================================================================
// DOCUMENTS TYPES (Certificates and Invoices)
// ============================================================================

// ============================================================================
// TABLE FILTER PREFERENCES (for server-side persistence)
// ============================================================================

// Submissions table filter preferences
export interface SubmissionsTableFilterPreferences {
	searchQuery?: string;
	phase?: SubmissionPhase | "all";
	botanist?: number | "all";
	finance?: number | "all";
	dateFrom?: string;
	dateTo?: string;
	cannabisOnly?: boolean;
	sortField?: string;
	sortDirection?: "asc" | "desc";
}

// Update the main TableFilterMap to include submissions, certificates, and invoices
export interface TableFilterMap {
	users: UsersTableFilterPreferences;
	"police-officers": OfficersTableFilterPreferences;
	"police-stations": StationsTableFilterPreferences;
	defendants: DefendantsTableFilterPreferences;
	submissions: SubmissionsTableFilterPreferences;
	certificates: CertificatesTableFilterPreferences;
	invoices: InvoicesTableFilterPreferences;
}

// ============================================================================
// SYSTEM SETTINGS (for pricing configuration)
// ============================================================================

export interface SystemSettings {
	cost_per_certificate: string; // DecimalField as string
	cost_per_bag: string;
	call_out_fee: string;
	cost_per_forensic_hour: string;
	cost_per_kilometer_fuel: string;
	tax_percentage: string;
}
