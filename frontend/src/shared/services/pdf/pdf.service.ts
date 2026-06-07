import { apiClient } from "@/shared/services/api/client.service";
import { PDF_ENDPOINTS } from "./pdf.endpoints";

export const downloadCertificatePdf = async (
	certificateId: number
): Promise<Blob> => {
	return apiClient.getBlob(PDF_ENDPOINTS.DOWNLOAD_CERTIFICATE(certificateId));
};

export const downloadInvoicePdf = async (invoiceId: number): Promise<Blob> => {
	return apiClient.getBlob(PDF_ENDPOINTS.DOWNLOAD_INVOICE(invoiceId));
};

export const openBlobInNewTab = (blob: Blob): void => {
	const pdfBlob = new Blob([blob], { type: "application/pdf" });
	const url = window.URL.createObjectURL(pdfBlob);
	window.open(url, "_blank");
	// Do not revoke immediately — the browser PDF viewer needs the URL
	// to remain valid for downloading. The URL is cleaned up when the
	// origin document is unloaded (page navigation or tab close).
};
