import type { IUser } from "@/features/user/types/users.types";

/**
 * Format user's display name from the backend full_name field.
 */
export const formatUserDisplayName = (user: IUser): string => {
	return user.full_name;
};

/**
 * Get a role badge label string for a user.
 * Priority: Admin > Staff > Role > None
 */
export const getUserRoleBadge = (user: IUser): string => {
	if (user.is_superuser) return "(Admin)";
	if (user.is_staff) return "(Staff)";
	if (user.role && user.role !== "none") {
		if (user.role === "botanist") return "(Botanist)";
		if (user.role === "finance") return "(Finance Officer)";
		return `(${user.role_display})`;
	}
	return "(None)";
};

/**
 * Get the appropriate colour class for a user's role badge.
 */
export const getUserRoleColorClass = (
	user: IUser,
	isDark: boolean = false
): string => {
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
};
