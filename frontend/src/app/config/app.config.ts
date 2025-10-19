export const APP_CONFIG = {
	// Application metadata (useful for debugging and info)
	NAME: "Cannabis",
	VERSION: import.meta.env.VITE_APP_VERSION || "1.0.0",
	ENVIRONMENT: import.meta.env.NODE_ENV || "development",

	// Cache configuration (used by hooks)
	CACHE: {
		DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes - used by police hooks
		USER_DATA_TTL: 10 * 60 * 1000, // 10 minutes - used by user hooks
	},
} as const;