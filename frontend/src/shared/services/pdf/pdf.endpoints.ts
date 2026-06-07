export const PDF_ENDPOINTS = {
	DOWNLOAD_CERTIFICATE: (certificateId: number) =>
		`cases/certificates/${certificateId}/download/`,
	DOWNLOAD_INVOICE: (invoiceId: number) =>
		`cases/invoices/${invoiceId}/download/`,
} as const;
