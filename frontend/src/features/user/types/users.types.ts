// User types - re-exports from backend API types for consistency
import type {
	User,
	UserRole,
	InviteRecord,
	PaginatedResponse,
} from "@/shared/types/backend-api.types";

// Re-export backend types with consistent naming
export type Role = UserRole;
export type IUser = User;

// Re-export other backend types
export type {
	UserPreferences,
	UserBasic,
	UserTiny,
	UserCreateRequest,
	UserUpdateRequest,
	PaginatedUsersResponse,
	InviteRecord,
	InviteUserRequest,
	ExternalUser,
	ExternalUserSearchResponse,
} from "@/shared/types/backend-api.types";

// User search parameters (frontend-specific interface)
export interface UserSearchParams {
	search?: string; // Backend uses 'search' parameter for text search
	query?: string; // Frontend convenience alias for 'search'
	page?: number; // Page number for pagination
	limit?: number; // Items per page
	role?: UserRole | "all"; // Role filter
	status?: string; // Status filter (active, inactive, staff, superuser)
	ordering?: string; // Sort field and direction
	is_active?: boolean;
	is_staff?: boolean;
	exclude?: number[];
	offset?: number;
}

// Invitation search parameters
export interface InvitationSearchParams {
	email?: string; // Filter by email
	is_valid?: boolean; // Filter by validity status
	is_used?: boolean; // Filter by usage status
	invited_by?: number; // Filter by inviter user ID
	role?: UserRole; // Filter by assigned role
	limit?: number;
	offset?: number;
	ordering?: string; // Sort field and direction
}

// Paginated invitations response
export interface PaginatedInvitationsResponse extends PaginatedResponse<InviteRecord> {}

// IT Assets integration types
export interface ITAssetsComboboxProps {
	onSelect: (userData: {
		email: string;
		first_name: string;
		last_name: string;
		it_asset_id: number;
		employee_id: string;
	}) => void;
}

// Form data types (matches backend exactly)
export interface EditUserFormData {
	email: string;
	first_name: string;
	last_name: string;
	role: Role;
	is_staff?: boolean;
	is_active?: boolean;
	it_asset_id?: number | null;
	employee_id?: string | null;
}

// Import BaseStoreState for proper inheritance
import type { BaseStoreState } from "@/app/stores/base.store";

/**
 * Pagination state interface for user lists.
 * Contains information about current page, total items, and navigation state.
 */
export interface PaginationState {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

/**
 * Search state interface for user search functionality.
 * Manages search query, results, and search-specific loading/error states.
 */
export interface SearchState {
	query: string;
	results: IUser[];
	isSearching: boolean;
	error: string | null;
}

/**
 * State interface for UsersStore that properly extends BaseStoreState.
 * This ensures compatibility with BaseStore while adding user-specific state.
 */
export interface UsersStoreState extends BaseStoreState {
	// Core user data
	users: IUser[];
	currentUser: IUser | null;
	pagination: PaginationState | null;

	// Search functionality
	search: SearchState;
}

/**
 * Helper function to create initial state for UsersStore.
 * Ensures consistent initial state structure with proper defaults.
 */
export function createUsersStoreState(
	overrides: Partial<UsersStoreState> = {}
): UsersStoreState {
	return {
		// BaseStoreState properties
		loading: false,
		error: null,
		initialised: false,

		// UsersStore-specific properties
		users: [],
		currentUser: null,
		pagination: null,
		search: {
			query: "",
			results: [],
			isSearching: false,
			error: null,
		},

		// Apply any overrides
		...overrides,
	};
}

/**
 * Legacy UserState interface - kept for backward compatibility.
 * @deprecated Use UsersStoreState instead for new implementations.
 */
export interface UserState {
	users: IUser[];
	currentUser: IUser | null;
	isLoading: boolean;
	error: string | null;
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	} | null;
}
