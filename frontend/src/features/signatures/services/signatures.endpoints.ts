/**
 * Signature API endpoint constants.
 *
 * No /api/v1 prefix — that's handled by BASE_URL in the API client config.
 */

export const SIGNATURE_ENDPOINTS = {
	ME: "/signatures/me",
	ME_IMAGE: "/signatures/me/image",
	USER: (userId: number) => `/signatures/${userId}`,
	USER_IMAGE: (userId: number) => `/signatures/${userId}/image`,
	AUDIT: "/signatures/audit",
	USER_AUDIT: (userId: number) => `/signatures/audit/${userId}`,
	SIGN_CERTIFICATE: (submissionId: number, certificateId: number) =>
		`/cases/${submissionId}/certificates/${certificateId}/sign`,
	UNLOCK_CERTIFICATE: (submissionId: number, certificateId: number) =>
		`/cases/${submissionId}/certificates/${certificateId}/unlock`,
} as const;
