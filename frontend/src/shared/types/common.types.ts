// Common utility types used across the application

// Generic ID type
export type ID = string | number;

// Generic timestamp type
export type Timestamp = string; // ISO datetime string

// Generic status type
export type Status = "active" | "inactive" | "pending" | "archived";

// Generic sort order
export type SortOrder = "asc" | "desc";

// Generic theme type
export type Theme = "light" | "dark" | "system";

// Generic display mode
export type DisplayMode = "grid" | "list";

// Generic loading state
export interface LoadingState {
	isLoading: boolean;
	error: string | null;
}

// Generic form state
export interface FormState<T> extends LoadingState {
	data: T;
	isDirty: boolean;
	isValid: boolean;
	errors: Record<string, string[]>;
}

// Generic table state
export interface TableState<T> extends LoadingState {
	data: T[];
	pagination: PaginationInfo | null;
	sorting: SortingInfo | null;
	filters: Record<string, any>;
}

// Pagination information
export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

// Sorting information
export interface SortingInfo {
	field: string;
	order: SortOrder;
}

// Filter information
export interface FilterInfo {
	field: string;
	value: any;
	operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
}

// Generic search parameters
export interface SearchParams {
	query?: string;
	filters?: FilterInfo[];
	sort?: SortingInfo;
	pagination?: {
		page?: number;
		limit?: number;
	};
}

// Generic modal state
export interface ModalState {
	isOpen: boolean;
	mode: "create" | "edit" | "view" | "delete";
	data?: any;
}

// Generic confirmation dialog state
export interface ConfirmationState {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel?: () => void;
}

// Generic notification type
export interface Notification {
	id: string;
	type: "success" | "error" | "warning" | "info";
	title: string;
	message?: string;
	duration?: number;
	actions?: NotificationAction[];
}

export interface NotificationAction {
	label: string;
	action: () => void;
}

// Generic breadcrumb type
export interface Breadcrumb {
	label: string;
	href?: string;
	isActive?: boolean;
}

// Generic menu item type
export interface MenuItem {
	id: string;
	label: string;
	icon?: string;
	href?: string;
	children?: MenuItem[];
	isActive?: boolean;
	isDisabled?: boolean;
	badge?: string | number;
}

// Generic file type
export interface FileInfo {
	id: string;
	name: string;
	size: number;
	type: string;
	url: string;
	uploadedAt: Timestamp;
	uploadedBy?: string;
}

// Generic audit trail
export interface AuditTrail {
	id: string;
	action: string;
	timestamp: Timestamp;
	userId: ID;
	userEmail: string;
	changes?: Record<string, { from: any; to: any }>;
	metadata?: Record<string, any>;
}

// Generic validation error
export interface ValidationError {
	field: string;
	message: string;
	code?: string;
}

// Generic API error
export interface ApiError {
	message: string;
	code: string;
	status: number;
	timestamp: Timestamp;
	path?: string;
	details?: Record<string, any>;
}

// Generic success response
export interface SuccessResponse<T = any> {
	success: true;
	data: T;
	message?: string;
	metadata?: Record<string, any>;
}

// Generic error response
export interface ErrorResponse {
	success: false;
	error: ApiError;
	message: string;
}

// Generic API response wrapper
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Generic async operation result
export interface AsyncResult<T> {
	data?: T;
	error?: string;
	isLoading: boolean;
	isSuccess: boolean;
	isError: boolean;
}

// Generic store state
export interface StoreState<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
	lastUpdated: Timestamp | null;
}

// Generic cache entry
export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

// Generic event type
export interface AppEvent<T = any> {
	type: string;
	payload: T;
	timestamp: Timestamp;
	source?: string;
}

// Generic configuration type
export interface AppConfig {
	apiUrl: string;
	environment: "development" | "staging" | "production";
	features: Record<string, boolean>;
	limits: Record<string, number>;
	timeouts: Record<string, number>;
}

// Generic user session
export interface UserSession {
	id: string;
	userId: ID;
	startTime: Timestamp;
	lastActivity: Timestamp;
	ipAddress?: string;
	userAgent?: string;
	isActive: boolean;
}

// Generic permission type
export interface Permission {
	id: string;
	name: string;
	description?: string;
	resource: string;
	action: string;
}

// Generic role type
export interface Role {
	id: string;
	name: string;
	description?: string;
	permissions: Permission[];
	isSystem?: boolean;
}

// Utility types for type safety
export type NonEmptyArray<T> = [T, ...T[]];
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type DeepRequired<T> = {
	[P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

// Type guards
export const isSuccessResponse = <T>(
	response: ApiResponse<T>
): response is SuccessResponse<T> => {
	return response.success === true;
};

export const isErrorResponse = (
	response: ApiResponse<any>
): response is ErrorResponse => {
	return response.success === false;
};

export const isValidId = (id: any): id is ID => {
	return typeof id === "string" || typeof id === "number";
};

export const isValidTimestamp = (timestamp: any): timestamp is Timestamp => {
	return typeof timestamp === "string" && !isNaN(Date.parse(timestamp));
};

// ============================================================================
// SHARED API PATTERNS (from backend-api.types.ts)
// ============================================================================

// Standard Django REST framework paginated response
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

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

// Sort direction
export type SortDirection = "asc" | "desc";

// Base table filter preferences
export interface BaseTableFilterPreferences {
	sortField?: string;
	sortDirection?: SortDirection;
}

// Forward declarations for table filter preferences
export interface UsersTableFilterPreferences extends BaseTableFilterPreferences {
	roleFilter?: string;
	statusFilter?: string;
}

export interface OfficersTableFilterPreferences extends BaseTableFilterPreferences {
	stationFilter?: string;
	rankFilter?: string;
	swornFilter?: string;
	includeUnknown?: boolean;
	unknownOnly?: boolean;
}

export interface StationsTableFilterPreferences extends BaseTableFilterPreferences {}

export interface DefendantsTableFilterPreferences extends BaseTableFilterPreferences {}

export interface SubmissionsTableFilterPreferences {
	searchQuery?: string;
	phase?: string;
	botanist?: number | "all";
	finance?: number | "all";
	dateFrom?: string;
	dateTo?: string;
	cannabisOnly?: boolean;
	sortField?: string;
	sortDirection?: "asc" | "desc";
}

export interface CertificatesTableFilterPreferences extends BaseTableFilterPreferences {}

export interface InvoicesTableFilterPreferences extends BaseTableFilterPreferences {}

// Combined table filter preferences map
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
// TYPE GUARDS FOR DJANGO ERRORS
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
