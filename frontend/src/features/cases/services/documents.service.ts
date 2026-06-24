import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type { Certificate, Invoice } from "@/shared/types/backend-api.types";

/**
 * Generate a certificate PDF for a case.
 * POST /cases/{submissionId}/certificates/generate/
 */
export const generateCertificate = async (
	submissionId: number
): Promise<Certificate> => {
	return apiClient.post<Certificate>(
		ENDPOINTS.CASES.DOCUMENTS.GENERATE_CERTIFICATE(submissionId)
	);
};

/**
 * Regenerate a certificate PDF (re-renders from current data).
 * POST /cases/{submissionId}/certificates/{certificateId}/regenerate/
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
 * Generate an invoice PDF for a case.
 * POST /cases/{submissionId}/invoices/generate/
 */
export const generateInvoice = async (
	submissionId: number,
	customerNumber: string
): Promise<Invoice> => {
	return apiClient.post<Invoice>(
		ENDPOINTS.CASES.DOCUMENTS.GENERATE_INVOICE(submissionId),
		{ customer_number: customerNumber }
	);
};

/**
 * Regenerate an invoice PDF (re-renders from current data).
 * POST /cases/{submissionId}/invoices/{invoiceId}/regenerate/
 */
export const regenerateInvoice = async (
	submissionId: number,
	invoiceId: number,
	customerNumber?: string
): Promise<Invoice> => {
	return apiClient.post<Invoice>(
		ENDPOINTS.CASES.DOCUMENTS.REGENERATE_INVOICE(submissionId, invoiceId),
		customerNumber ? { customer_number: customerNumber } : undefined
	);
};

/**
 * Delete an invoice record.
 * DELETE /cases/invoices/{invoiceId}
 */
export const deleteInvoice = async (invoiceId: number): Promise<void> => {
	return apiClient.delete(ENDPOINTS.INVOICES.DELETE(invoiceId));
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

/**
 * Get the relative URL path for viewing an invoice PDF.
 */
export const getInvoicePdfUrl = (
	submissionId: number,
	invoiceId: number
): string => {
	return ENDPOINTS.CASES.DOCUMENTS.INVOICE_PDF(submissionId, invoiceId);
};
