/**
 * Practice mode API endpoint constants. Paths are relative to the API base URL,
 * which already includes /api/v1/.
 */
export const PRACTICE_ENDPOINTS = {
	MODE: "/practice/mode",
	RESET: "/practice/reset",
	RESET_CASE: (caseId: number) => `/practice/reset-case/${caseId}`,
} as const;
