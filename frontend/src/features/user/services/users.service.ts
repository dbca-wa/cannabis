import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { 
	type ServiceResult,
	type InviteUserRequest,
	type InviteRecord,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";
import {
	type IUser,
	type PaginatedUsersResponse,
	type UserSearchParams,
} from "@/features/user/types/users.types";
import type { AddUserFormData } from "../components/forms/schemas/addUserSchema";

class UsersService {
	private generateRequestId(): string {
		return `users_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 8)}`;
	}

	async getUsers(
		params: UserSearchParams = {}
	): Promise<ServiceResult<PaginatedUsersResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching users list", { params, requestId });

		try {
			// Build query parameters using utility function
			const cleanParams = buildQueryParams({
				page: params.page,
				limit: params.limit,
				search: params.query?.trim(),
				role: params.role !== "all" ? params.role : undefined,
				status: params.status !== "all" ? params.status : undefined,
				ordering: params.ordering,
				exclude: params.exclude,
			});

			logger.debug("Making users request", {
				endpoint: ENDPOINTS.USERS.LIST,
				params: cleanParams,
				requestId,
			});

			const response = await apiClient.get<PaginatedUsersResponse>(
				ENDPOINTS.USERS.LIST,
				{ params: cleanParams }
			);

			logger.info("Users fetched successfully", {
				count: response.results?.length || 0,
				totalCount: response.count,
				hasNext: !!response.next,
				hasPrevious: !!response.previous,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch users", {
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as PaginatedUsersResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async searchUsers(
		params: UserSearchParams
	): Promise<ServiceResult<PaginatedUsersResponse>> {
		const requestId = this.generateRequestId();
		logger.info("Searching users", { params, requestId });

		try {
			// Build query parameters using utility function
			const cleanParams = buildQueryParams({
				search: params.query?.trim(),
				limit: params.limit,
				offset: params.offset,
				role: params.role !== "none" ? params.role : undefined,
				exclude: params.exclude,
			});

			logger.debug("Making search request", {
				endpoint: ENDPOINTS.USERS.LIST,
				params: cleanParams,
				searchQuery: params.query,
				requestId,
			});

			const response = await apiClient.get<PaginatedUsersResponse>(
				ENDPOINTS.USERS.LIST,
				{ params: cleanParams }
			);

			logger.info("User search completed successfully", {
				count: response.results?.length || 0,
				total: response.count,
				searchQuery: params.query,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to search users", {
				params,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as PaginatedUsersResponse,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async getUserById(id: number): Promise<ServiceResult<IUser>> {
		const requestId = this.generateRequestId();
		logger.info("Fetching user by ID", { userId: id, requestId });

		try {
			const response = await apiClient.get<IUser>(
				ENDPOINTS.USERS.DETAIL(id)
			);

			logger.info("User fetched successfully", {
				userId: id,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to fetch user", {
				userId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as IUser,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async createUser(userData: AddUserFormData): Promise<ServiceResult<IUser>> {
		const requestId = this.generateRequestId();
		logger.info("Creating new user", {
			email: userData.email,
			requestId,
		});

		try {
			const response = await apiClient.post<IUser>(
				ENDPOINTS.USERS.CREATE,
				userData
			);

			logger.info("User created successfully", {
				userId: response.id,
				email: userData.email,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to create user", {
				email: userData.email,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as IUser,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async updateUser(
		id: string | number,
		userData: Partial<IUser>
	): Promise<ServiceResult<IUser>> {
		const requestId = this.generateRequestId();
		logger.info("Updating user", {
			userId: id,
			requestId,
			fields: Object.keys(userData),
		});

		try {
			// Clean the data - remove undefined values and ensure proper types
			const cleanedData = Object.entries(userData).reduce(
				(acc, [key, value]) => {
					if (value !== undefined) {
						acc[key] = value;
					}
					return acc;
				},
				{} as Record<string, unknown>
			);

			const response = await apiClient.patch<IUser>(
				ENDPOINTS.USERS.UPDATE(id),
				cleanedData
			);

			logger.info("User updated successfully", {
				userId: id,
				requestId,
				updatedFields: Object.keys(cleanedData),
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to update user", {
				userId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: {} as IUser,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	async deleteUser(id: string | number): Promise<ServiceResult<void>> {
		const requestId = this.generateRequestId();
		logger.info("Deleting user", {
			userId: id,
			requestId,
		});

		try {
			await apiClient.delete(ENDPOINTS.USERS.DELETE(id));

			logger.info("User deleted successfully", {
				userId: id,
				requestId,
			});

			return {
				data: undefined,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to delete user", {
				userId: id,
				message: normalizedError.message,
				code: normalizedError.code,
				requestId,
				error: normalizedError.originalError,
			});

			return {
				data: undefined,
				success: false,
				error: normalizedError.message,
			};
		}
	}

	/**
	 * @deprecated Use invitationService.sendInvitation() instead
	 */
	async inviteUser(inviteData: InviteUserRequest): Promise<ServiceResult<InviteRecord>> {
		const { invitationService } = await import("./invitation.service");
		return invitationService.sendInvitation(inviteData);
	}

	static formatUserDisplayName(user: IUser): string {
		// Backend already provides full_name as computed field
		return user.full_name;
	}

	static getUserRoleBadge(user: IUser): string {
		// Priority: Admin > Staff > Role > None
		if (user.is_superuser) return "(Admin)";
		if (user.is_staff) return "(Staff)";
		if (user.role && user.role !== "none") {
			// Use custom display text to match requirements
			if (user.role === "botanist") return "(Botanist)";
			if (user.role === "finance") return "(Finance Officer)";
			return `(${user.role_display})`; // Fallback to backend display
		}
		return "(None)";
	}

	static getUserRoleColorClass(user: IUser, isDark: boolean = false): string {
		if (user.is_superuser) {
			return isDark ? "text-red-400" : "text-red-600";
		}
		if (user.is_staff) {
			return isDark ? "text-blue-400" : "text-blue-600";
		}
		if (user.role === "botanist") {
			return isDark ? "text-green-400" : "text-green-600";
		}
		if (user.role === "finance") {
			return isDark ? "text-yellow-400" : "text-yellow-600";
		}
		return isDark ? "text-gray-400" : "text-gray-600";
	}

	/**
	 * Export all users data (bypasses pagination)
	 */
	static async exportUsers(
		format: "csv" | "json" = "csv",
		params: Omit<UserSearchParams, "page" | "limit"> = {}
	): Promise<Blob> {
		// Build query parameters using utility function
		const cleanParams = buildQueryParams({
			format: format,
			search: params.query,
			role: params.role !== "all" ? params.role : undefined,
			is_active:
				params.status && params.status !== "all"
					? params.status === "active"
					: undefined,
			ordering: params.ordering,
		});

		try {
			// Use apiClient.getBlob for proper authentication and base URL handling
			return await apiClient.getBlob(ENDPOINTS.USERS.EXPORT, {
				params: cleanParams,
			});
		} catch (error) {
			throw error;
		}
	}
}

// Export singleton instance
export const usersService = new UsersService();

// Export class for static method access
export { UsersService };
