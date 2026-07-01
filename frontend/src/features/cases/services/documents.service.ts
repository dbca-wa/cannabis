import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type { Certificate } from "@/shared/types/backend-api.types";

/**
 * Generate certificate PDFs for a case (one per bag group, max 5 bags each).
 * POST /cases/{submissionId}/certificates/generate
 *
 * @param groups Optional explicit bag grouping (list of bag-id lists). When
 *   omitted, the backend auto-groups bags into chunks of five.
 */
export const generateCertificates = async (
	submissionId: number,
	groups?: number[][]
): Promise<Certificate[]> => {
	return apiClient.post<Certificate[]>(
		ENDPOINTS.CASES.DOCUMENTS.GENERATE_CERTIFICATE(submissionId),
		groups ? { groups } : undefined
	);
};

/**
 * Regenerate a certificate PDF (re-renders from current data).
 * POST /cases/{submissionId}/certificates/{certificateId}/regenerate
 */
export const regenerateCertificate = async (
	submissionId: number,
	certificateId: number
): Promise<Certificate> => {
	return apiClient.post<Certificate>(
		ENDPOINTS.CASES.DOCUMENTS.REGENERATE_CERTIFICATE(
			submissionId,
			certificateId
		)
	);
};

/**
 * Get the relative URL path for viewing a certificate PDF.
 */
export const getCertificatePdfUrl = (
	submissionId: number,
	certificateId: number
): string => {
	return ENDPOINTS.CASES.DOCUMENTS.CERTIFICATE_PDF(submissionId, certificateId);
};
