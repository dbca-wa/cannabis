import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";
import {
	type IUser,
	type PaginatedUsersResponse,
	type UserSearchParams,
} from "@/features/user/types/users.types";
import type { AddUserFormData } from "../components/forms/schemas/addUserSchema";
import type {
	InviteUserRequest,
	InviteRecord,
} from "@/shared/types/backend-api.types";

/**
 * Fetch paginated list of users with optional filters.
 */
export const getUsers = async (
	params: UserSearchParams = {}
): Promise<PaginatedUsersResponse> => {
	const cleanParams = buildQueryParams({
		page: params.page,
		limit: params.limit,
		search: params.query?.trim(),
		role: params.role !== "all" ? params.role : undefined,
		status: params.status !== "all" ? params.status : undefined,
		ordering: params.ordering,
		exclude: params.exclude,
	});

	return apiClient.get<PaginatedUsersResponse>(ENDPOINTS.USERS.LIST, {
		params: cleanParams,
	});
};

/**
 * Search users with query and optional filters.
 */
export const searchUsers = async (
	params: UserSearchParams
): Promise<PaginatedUsersResponse> => {
	const cleanParams = buildQueryParams({
		search: params.query?.trim(),
		limit: params.limit,
		offset: params.offset,
		role: params.role !== "none" ? params.role : undefined,
		exclude: params.exclude,
	});

	return apiClient.get<PaginatedUsersResponse>(ENDPOINTS.USERS.LIST, {
		params: cleanParams,
	});
};

/**
 * Get a single user by ID.
 */
export const getUserById = async (id: number): Promise<IUser> => {
	return apiClient.get<IUser>(ENDPOINTS.USERS.DETAIL(id));
};

/**
 * Create a new user.
 */
export const createUser = async (userData: AddUserFormData): Promise<IUser> => {
	return apiClient.post<IUser>(ENDPOINTS.USERS.CREATE, userData);
};

/**
 * Update an existing user (partial patch).
 */
export const updateUser = async (
	id: string | number,
	userData: Partial<IUser>
): Promise<IUser> => {
	const cleanedData = Object.entries(userData).reduce(
		(acc, [key, value]) => {
			if (value !== undefined) {
				acc[key] = value;
			}
			return acc;
		},
		{} as Record<string, unknown>
	);

	return apiClient.patch<IUser>(ENDPOINTS.USERS.UPDATE(id), cleanedData);
};

/**
 * Delete a user by ID.
 */
export const deleteUser = async (id: string | number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.USERS.DELETE(id));
};

/**
 * Send a user invitation.
 */
export const inviteUser = async (
	inviteData: InviteUserRequest
): Promise<InviteRecord> => {
	const { invitationService } = await import("./invitation.service");
	const result = await invitationService.sendInvitation(inviteData);
	if (!result.success) {
		throw new Error(result.error || "Failed to send invitation");
	}
	return result.data;
};

/**
 * Admin-triggered password reset email for a specific user.
 */
export const sendResetEmail = async (
	userId: number
): Promise<{ success: boolean; message: string }> => {
	return apiClient.post<{ success: boolean; message: string }>(
		`/users/${userId}/send-reset-email`,
		{}
	);
};
