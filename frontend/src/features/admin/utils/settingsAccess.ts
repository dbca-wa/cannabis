import type { User } from "@/shared/types/backend-api.types";

/** Whether the user can change Settings, and why not when they cannot. */
export type SettingsAccess =
	| { canEdit: true; canEditSystemFlags: boolean; hasRole: true }
	| {
			canEdit: false;
			canEditSystemFlags: false;
			/** Whether they hold an app role (they may be in practice mode). */
			hasRole: boolean;
			reason: string;
	  };

/**
 * Who can change Settings, matching the server.
 *
 * Anyone signed in can see Settings. Finance officers, botanists and
 * administrators can change rates, numbering and case defaults; only
 * administrators can change the system flags (such as remembered searches).
 * Nobody can change Settings in practice mode, because settings are real and
 * shared with everyone.
 */
export const getSettingsAccess = (
	user: User | null | undefined
): SettingsAccess => {
	const isAdmin = !!(user?.is_staff || user?.is_superuser);
	const hasRole =
		isAdmin || user?.role === "finance" || user?.role === "botanist";

	if (!user || !hasRole) {
		return {
			canEdit: false,
			canEditSystemFlags: false,
			hasRole: false,
			reason:
				"You can view these settings. Only finance officers, botanists and administrators can change them.",
		};
	}
	if (user.practice_mode) {
		return {
			canEdit: false,
			canEditSystemFlags: false,
			hasRole: true,
			reason:
				"You are in practice mode. Settings are shared with everyone, so leave practice mode to change them.",
		};
	}
	return { canEdit: true, canEditSystemFlags: isAdmin, hasRole: true };
};
