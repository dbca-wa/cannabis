export const STORAGE_CONFIG = {
	// Storage keys
	KEYS: {
		USER_PREFERENCES: "cannabis_user_preferences",
		THEME: "cannabis_theme",
		SEARCH_HISTORY: "cannabis_search_history",
	},

	// Storage types
	STORAGE_TYPES: {
		LOCAL: {
			PREFIX: "cannabis_local_",
			ENCRYPTION: true,
			MAX_SIZE: 10 * 1024 * 1024, // 10MB
		},
		SESSION: {
			PREFIX: "cannabis_session_",
			ENCRYPTION: false,
		},
	},

	// TTL settings
	TTL: {
		USER_PREFERENCES: 7 * 24 * 60 * 60 * 1000, // 7 days
		THEME_SETTINGS: 30 * 24 * 60 * 60 * 1000, // 30 days
		CACHE_DATA: 30 * 60 * 1000, // 30 minutes
	},

	// Security settings (used by storage service)
	SECURITY: {
		ENCRYPT_SENSITIVE_DATA: true,
		ENCRYPTION_KEY: "cannabis-app-storage-key-2025", // Should be from env in production
	},

	// Cleanup configuration (used by storage service)
	CLEANUP: {
		ENABLED: true,
		INTERVAL: 60 * 60 * 1000, // 1 hour
		EXPIRED_CLEANUP: true,
		SIZE_LIMIT_CLEANUP: true,
	},

	// Migration settings (used by storage service)
	MIGRATION: {
		CURRENT_VERSION: "1.0.0",
		AUTO_MIGRATE: true,
	},
} as const;