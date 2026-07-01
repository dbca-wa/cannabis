// System Settings types that match the backend API exactly

// Re-export the existing SystemSettings type from shared types
export type { SystemSettings } from "@/shared/types/backend-api.types";

// Audit user information for settings changes (matches the nested type in SystemSettings)
export interface SettingsAuditUser {
	id: number;
	email: string;
	given_names: string | null;
	last_name: string | null;
}

// Settings update request (partial updates allowed)
export interface SystemSettingsUpdateRequest {
	cost_per_certificate?: string;
	cost_per_bag?: string;
	tax_percentage?: string;
	forward_certificate_emails_to?: string;
	send_emails_to_self?: boolean;
}

// Settings validation error response
export interface SettingsValidationError {
	errors: Record<string, string[]>;
	message: string;
	error_count: number;
}

// Settings change notification data
export interface SettingsChangeNotification {
	field: string;
	oldValue: string;
	newValue: string;
	timestamp: string;
	user: SettingsAuditUser;
}

// Cache metadata for settings
export interface SettingsCacheMetadata {
	lastFetched: number;
	etag?: string;
	version: number;
}

// Settings service configuration
export interface SettingsServiceConfig {
	cacheTimeout: number; // milliseconds
	retryAttempts: number;
	retryDelay: number; // milliseconds
	enableOptimisticUpdates: boolean;
	enableChangeNotifications: boolean;
}
