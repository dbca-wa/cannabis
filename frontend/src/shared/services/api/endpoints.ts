// API endpoints - simple URL constants (no /api/v1 prefix, that's in BASE_URL)
export const ENDPOINTS = {
	// Auth endpoints
	AUTH: {
		LOGIN: "/users/auth/login/",
		LOGOUT: "/users/auth/logout/",
		REFRESH: "/users/auth/refresh/",
		ME: "/users/whoami/", // Back to whoami endpoint - will fix backend to include admin fields
	},

	// User endpoints
	USERS: {
		LIST: "/users/",
		CREATE: "/users/",
		EXPORT: "/users/export/",
		DETAIL: (id: string | number) => `/users/${id}/`,
		UPDATE: (id: string | number) => `/users/${id}/`,
		DELETE: (id: string | number) => `/users/${id}/`,
		PREFERENCES: "/users/preferences/", // Dedicated preferences endpoint
		EXTERNAL_SEARCH: "/users/external-search/", // External user search for invitations
		INVITE: "/users/invite/", // Send user invitation
	},

	// Police endpoints
	POLICE: {
		// Police Station endpoints
		STATIONS: {
			LIST: "/police/stations/",
			CREATE: "/police/stations/",
			EXPORT: "/police/stations/export/",
			DETAIL: (id: string | number) => `/police/stations/${id}/`,
			UPDATE: (id: string | number) => `/police/stations/${id}/`,
			DELETE: (id: string | number) => `/police/stations/${id}/`,
		},
		// Police Officer endpoints
		OFFICERS: {
			LIST: "/police/officers/",
			CREATE: "/police/officers/",
			EXPORT: "/police/officers/export/",
			DETAIL: (id: string | number) => `/police/officers/${id}/`,
			UPDATE: (id: string | number) => `/police/officers/${id}/`,
			DELETE: (id: string | number) => `/police/officers/${id}/`,
		},
	},

	// Defendants endpoints
	DEFENDANTS: {
		LIST: "/defendants/",
		CREATE: "/defendants/",
		EXPORT: "/defendants/export/",
		DETAIL: (id: string | number) => `/defendants/${id}/`,
		UPDATE: (id: string | number) => `/defendants/${id}/`,
		DELETE: (id: string | number) => `/defendants/${id}/`,
	},

	// Certificates endpoints
	CERTIFICATES: {
		LIST: "/submissions/certificates/",
		CREATE: "/submissions/certificates/",
		EXPORT: "/submissions/certificates/export/",
		DETAIL: (id: string | number) => `/submissions/certificates/${id}/`,
		UPDATE: (id: string | number) => `/submissions/certificates/${id}/`,
		DELETE: (id: string | number) => `/submissions/certificates/${id}/`,
		DOWNLOAD: (id: string | number) =>
			`/submissions/certificates/${id}/download/`,
	},

	// Invoices endpoints
	INVOICES: {
		LIST: "/submissions/invoices/",
		CREATE: "/submissions/invoices/",
		EXPORT: "/submissions/invoices/export/",
		DETAIL: (id: string | number) => `/submissions/invoices/${id}/`,
		UPDATE: (id: string | number) => `/submissions/invoices/${id}/`,
		DELETE: (id: string | number) => `/submissions/invoices/${id}/`,
		DOWNLOAD: (id: string | number) =>
			`/submissions/invoices/${id}/download/`,
	},

	// System endpoints
	SYSTEM: {
		SETTINGS: "/system/settings/",
	},
} as const;
