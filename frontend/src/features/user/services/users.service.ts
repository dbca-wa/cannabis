import { logger } from "@/shared/services/logger.service";
import { normalizeError } from "@/shared/utils/error.utils";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { type ServiceResult } from "@/shared/types/backend-api.types";
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
			// Build query parameters
			const searchParams = new URLSearchParams();

			// Pagination parameters
			if (params.page)
				searchParams.append("page", params.page.toString());
			if (params.limit)
				searchParams.append("limit", params.limit.toString());

			// Search and filter parameters
			if (params.query && params.query.trim()) {
				searchParams.append("search", params.query.trim());
			}
			if (params.role && params.role !== "all") {
				searchParams.append("role", params.role);
			}
			if (params.status && params.status !== "all") {
				searchParams.append("status", params.status);
			}
			if (params.ordering) {
				searchParams.append("ordering", params.ordering);
			}

			// Add exclude parameters
			if (params.exclude?.length) {
				params.exclude.forEach((id) =>
					searchParams.append("exclude", id.toString())
				);
			}

			const queryString = searchParams.toString();
			const endpoint = queryString
				? `${ENDPOINTS.USERS.LIST}?${queryString}`
				: ENDPOINTS.USERS.LIST;

			logger.debug("Making users request", {
				endpoint,
				queryString,
				params,
				requestId,
			});

			const response = await apiClient.get<PaginatedUsersResponse>(
				endpoint
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
			// Build query parameters manually (simple approach)
			const searchParams = new URLSearchParams();

			if (params.query && params.query.trim()) {
				searchParams.append("search", params.query.trim());
			}
			if (params.limit)
				searchParams.append("limit", params.limit.toString());
			if (params.offset)
				searchParams.append("offset", params.offset.toString());
			if (params.role && params.role !== "none")
				searchParams.append("role", params.role);

			// Add exclude parameters
			if (params.exclude?.length) {
				params.exclude.forEach((id) =>
					searchParams.append("exclude", id.toString())
				);
			}

			const queryString = searchParams.toString();
			const endpoint = queryString
				? `${ENDPOINTS.USERS.LIST}?${queryString}`
				: ENDPOINTS.USERS.LIST;

			logger.debug("Making search request", {
				endpoint,
				queryString,
				searchQuery: params.query,
				requestId,
			});

			const response = await apiClient.get<PaginatedUsersResponse>(
				endpoint
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

	async inviteUser(inviteData: {
		external_user_data: {
			email: string;
			[key: string]: unknown;
		};
		role: string;
		is_staff?: boolean;
		is_active?: boolean;
	}): Promise<ServiceResult<IUser>> {
		const requestId = this.generateRequestId();
		logger.info("Sending user invitation", {
			email: inviteData.external_user_data?.email,
			role: inviteData.role,
			requestId,
		});

		try {
			const response = await apiClient.post<IUser>(
				ENDPOINTS.USERS.INVITE,
				inviteData
			);

			logger.info("User invitation sent successfully", {
				userId: response.id,
				email: inviteData.external_user_data?.email,
				requestId,
			});

			return {
				data: response,
				success: true,
			};
		} catch (error: unknown) {
			const normalizedError = normalizeError(error);

			logger.error("Failed to send user invitation", {
				email: inviteData.external_user_data?.email,
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
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("format", format);

		// Add filtering parameters (but not pagination)
		if (params.query) searchParams.append("search", params.query);
		if (params.role && params.role !== "all")
			searchParams.append("role", params.role);
		if (params.status && params.status !== "all")
			searchParams.append(
				"is_active",
				params.status === "active" ? "true" : "false"
			);
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.USERS.EXPORT}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			// Use apiClient.getBlob for proper authentication and base URL handling
			return await apiClient.getBlob(url);
		} catch (error) {
			throw error;
		}
	}
}

// Export singleton instance
export const usersService = new UsersService();

// Export class for static method access
export { UsersService };
