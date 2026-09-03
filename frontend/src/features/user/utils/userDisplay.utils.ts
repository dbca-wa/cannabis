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

/**
 * Safely determine a user's role from potentially incomplete data
 */
export const determineUserRole = (
	userData: { role?: string } | null
): "botanist" | "finance" | "none" => {
	if (!userData) return "none";
	if (
		userData.role &&
		["botanist", "finance", "none"].includes(userData.role)
	) {
		return userData.role as "botanist" | "finance" | "none";
	}
	return "none";
};

/**
 * Get role badge configuration with label and Tailwind classes
 */
export const getRoleBadgeConfig = (user: {
	is_superuser: boolean;
	role: string;
}): {
	label: string;
	classes: string;
} => {
	if (user.is_superuser) {
		return {
			label: "Admin",
			classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
		};
	}
	switch (user.role) {
		case "botanist":
			return {
				label: "Botanist",
				classes:
					"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
			};
		case "finance":
			return {
				label: "Finance",
				classes:
					"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
			};
		default:
			return {
				label: "No Role",
				classes:
					"bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
			};
	}
};

export interface RoleBadge {
	label: string;
	classes: string;
}

/**
 * Get all applicable role badges for a user, in display order:
 * Admin, Finance, Botanist, Legacy.
 *
 * A user can be an admin as well as a botanist or finance officer
 * (but not both botanist and finance), and may additionally be legacy.
 * This returns every badge that applies rather than a single one.
 */
export const getRoleBadges = (user: {
	is_superuser: boolean;
	role: string;
	is_legacy?: boolean;
}): RoleBadge[] => {
	const badges: RoleBadge[] = [];

	if (user.is_superuser) {
		badges.push({
			label: "Admin",
			classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
		});
	}

	if (user.role === "finance") {
		badges.push({
			label: "Finance",
			classes:
				"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
		});
	} else if (user.role === "botanist") {
		badges.push({
			label: "Botanist",
			classes:
				"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
		});
	}

	if (user.is_legacy) {
		badges.push({
			label: "Legacy",
			classes:
				"bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
		});
	}

	// Fall back to a "No Role" badge when nothing else applies
	if (badges.length === 0) {
		badges.push({
			label: "No Role",
			classes: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
		});
	}

	return badges;
};
