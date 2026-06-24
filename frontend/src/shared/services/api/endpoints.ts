// API endpoints - simple URL constants (no /api/v1 prefix, that's in BASE_URL)
export const ENDPOINTS = {
	// Auth endpoints
	AUTH: {
		LOGIN: "/users/auth/login",
		LOGOUT: "/users/auth/logout",
		REFRESH: "/users/auth/refresh",
		ME: "/users/whoami", // Back to whoami endpoint - will fix backend to include admin fields
		UPDATE_PASSWORD: "/users/auth/update-password",
		FORGOT_PASSWORD: "/users/auth/forgot-password",
		VERIFY_RESET_CODE: "/users/auth/verify-reset-code",

		ACTIVATE_INVITE: (token: string) => `/users/auth/activate-invite/${token}`,
		VALIDATE_PASSWORD: "/users/validate-password",
	},

	// User endpoints
	USERS: {
		LIST: "/users/list",
		CREATE: "/users/list",
		EXPORT: "/users/export",
		DETAIL: (id: string | number) => `/users/${id}`,
		UPDATE: (id: string | number) => `/users/${id}`,
		DELETE: (id: string | number) => `/users/${id}`,
		PREFERENCES: "/users/preferences", // Dedicated preferences endpoint
		EXTERNAL_SEARCH: "/users/external-search", // External user search for invitations
		INVITE: "/users/invite", // Send user invitation
		INVITATIONS: "/users/invitations", // List invitations
		CANCEL_INVITATION: (id: string | number) =>
			`/users/invitations/${id}/cancel`, // Cancel invitation
	},

	// Police endpoints
	POLICE: {
		// Police Station endpoints
		STATIONS: {
			LIST: "/police/stations",
			CREATE: "/police/stations",
			EXPORT: "/police/stations/export",
			MERGE: "/police/stations/merge",
			DETAIL: (id: string | number) => `/police/stations/${id}`,
			UPDATE: (id: string | number) => `/police/stations/${id}`,
			DELETE: (id: string | number) => `/police/stations/${id}`,
		},
		// Police Officer endpoints
		OFFICERS: {
			LIST: "/police/officers",
			CREATE: "/police/officers",
			EXPORT: "/police/officers/export",
			DETAIL: (id: string | number) => `/police/officers/${id}`,
			UPDATE: (id: string | number) => `/police/officers/${id}`,
			DELETE: (id: string | number) => `/police/officers/${id}`,
		},
	},

	// Defendants endpoints
	DEFENDANTS: {
		LIST: "/defendants/list",
		CREATE: "/defendants/list",
		EXPORT: "/defendants/export",
		MERGE: "/defendants/merge",
		DETAIL: (id: string | number) => `/defendants/${id}`,
		UPDATE: (id: string | number) => `/defendants/${id}`,
		DELETE: (id: string | number) => `/defendants/${id}`,
	},

	// Cases endpoints
	CASES: {
		LIST: "/cases/list",
		CREATE: "/cases/list",
		DETAIL: (id: string | number) => `/cases/${id}`,
		UPDATE: (id: string | number) => `/cases/${id}`,
		DELETE: (id: string | number) => `/cases/${id}`,
		WORKFLOW: (id: string | number) => `/cases/${id}/workflow`,
		SEND_BACK: (id: string | number) => `/cases/${id}/send-back`,
		PHASE_HISTORY: (id: string | number) => `/cases/${id}/phase-history`,
		OCR_UPLOAD: "/cases/ocr-upload",
		BAGS: {
			LIST: (caseId: string | number) => `/cases/${caseId}/bags`,
			CREATE: (caseId: string | number) => `/cases/${caseId}/bags`,
			BATCH_CREATE: (caseId: string | number) => `/cases/${caseId}/bags/batch`,
			DETAIL: (id: string | number) => `/cases/bags/${id}`,
			UPDATE: (id: string | number) => `/cases/bags/${id}`,
			DELETE: (id: string | number) => `/cases/bags/${id}`,
		},
		ASSESSMENTS: {
			DETAIL: (id: string | number) => `/cases/assessments/${id}`,
			CREATE: (drugBagId: string | number) =>
				`/cases/bags/${drugBagId}/assessment`,
			UPDATE: (id: string | number) => `/cases/assessments/${id}`,
			DELETE: (id: string | number) => `/cases/assessments/${id}`,
		},
		DOCUMENTS: {
			GENERATE_CERTIFICATE: (caseId: string | number) =>
				`/cases/${caseId}/certificates/generate`,
			REGENERATE_CERTIFICATE: (
				caseId: string | number,
				certId: string | number
			) => `/cases/${caseId}/certificates/${certId}/regenerate`,
			GENERATE_INVOICE: (caseId: string | number) =>
				`/cases/${caseId}/invoices/generate`,
			REGENERATE_INVOICE: (
				caseId: string | number,
				invoiceId: string | number
			) => `/cases/${caseId}/invoices/${invoiceId}/regenerate`,
			CERTIFICATE_PDF: (caseId: string | number, certId: string | number) =>
				`/cases/${caseId}/certificates/${certId}/pdf`,
			INVOICE_PDF: (caseId: string | number, invoiceId: string | number) =>
				`/cases/${caseId}/invoices/${invoiceId}/pdf`,
		},
	},

	// Certificates endpoints
	CERTIFICATES: {
		LIST: "/cases/certificates",
		CREATE: "/cases/certificates",
		EXPORT: "/cases/certificates/export",
		DETAIL: (id: string | number) => `/cases/certificates/${id}`,
		UPDATE: (id: string | number) => `/cases/certificates/${id}`,
		DELETE: (id: string | number) => `/cases/certificates/${id}`,
		DOWNLOAD: (id: string | number) => `/cases/certificates/${id}/download`,
	},

	// Invoices endpoints
	INVOICES: {
		LIST: "/cases/invoices",
		CREATE: "/cases/invoices",
		EXPORT: "/cases/invoices/export",
		DETAIL: (id: string | number) => `/cases/invoices/${id}`,
		UPDATE: (id: string | number) => `/cases/invoices/${id}`,
		DELETE: (id: string | number) => `/cases/invoices/${id}`,
		DOWNLOAD: (id: string | number) => `/cases/invoices/${id}/download`,
	},

	// Dashboard endpoints (aggregation views over cases data)
	DASHBOARD: {
		MY_SUBMISSIONS: "/cases/my",
		STATS_CERTIFICATES: "/cases/stats/certificates",
		STATS_REVENUE: "/cases/stats/revenue",
		STATS_THROUGHPUT: "/cases/stats/throughput",
		PENDING_ATTENTION: "/cases/pending-attention",
	},

	// System endpoints
	SYSTEM: {
		SETTINGS: "/system/settings",
	},
} as const;
