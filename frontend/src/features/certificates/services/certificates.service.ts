import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Certificate,
	CertificateCreateRequest,
	PaginatedCertificatesResponse,
	CertificateSearchParams,
} from "@/shared/types/backend-api.types";

export interface CertificatesQueryParams {
	page?: number;
	search?: string;
	submission?: number;
	ordering?: string;
	limit?: number;
}

export class CertificatesService {
	//  Get paginated list of certificates
	static async getCertificates(
		params: CertificatesQueryParams = {}
	): Promise<PaginatedCertificatesResponse> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());

		const url = `${ENDPOINTS.CERTIFICATES.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedCertificatesResponse>(
				url
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	// Get a single certificate by ID
	static async getCertificateById(id: number): Promise<Certificate> {
		try {
			const result = await apiClient.get<Certificate>(
				ENDPOINTS.CERTIFICATES.DETAIL(id)
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	// Create a new certificate
	static async createCertificate(
		data: CertificateCreateRequest
	): Promise<Certificate> {
		try {
			const result = await apiClient.post<Certificate>(
				ENDPOINTS.CERTIFICATES.CREATE,
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	// Update a certificate
	static async updateCertificate(
		id: number,
		data: Partial<CertificateCreateRequest>
	): Promise<Certificate> {
		try {
			const result = await apiClient.put<Certificate>(
				ENDPOINTS.CERTIFICATES.UPDATE(id),
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	// Delete a certificate
	static async deleteCertificate(id: number): Promise<void> {
		try {
			await apiClient.delete(ENDPOINTS.CERTIFICATES.DELETE(id));
		} catch (error) {
			throw error;
		}
	}

	// Search certificates with debounced functionality
	static async searchCertificates(
		params: CertificateSearchParams
	): Promise<PaginatedCertificatesResponse> {
		const searchParams = new URLSearchParams();

		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.offset)
			searchParams.append("offset", params.offset.toString());

		const url = `${ENDPOINTS.CERTIFICATES.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedCertificatesResponse>(
				url
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	// Download certificate PDF
	static async downloadCertificate(id: number): Promise<Blob> {
		try {
			const blob = await apiClient.getBlob(
				ENDPOINTS.CERTIFICATES.DOWNLOAD(id)
			);

			return blob;
		} catch (error) {
			throw error;
		}
	}

	// Format certificate display name for UI components
	static formatCertificateDisplayName(certificate: Certificate): string {
		return certificate.certificate_number;
	}

	// Get certificate status badge text
	static getCertificateStatusBadge(certificate: Certificate): string {
		if (certificate.pdf_generating) return "Generating";
		if (certificate.pdf_file) return "Generated";
		return "Pending";
	}

	// Get certificate status badge color class
	static getCertificateStatusBadgeColorClass(
		certificate: Certificate,
		isDark: boolean = false
	): string {
		if (certificate.pdf_generating) {
			return isDark ? "text-yellow-400" : "text-yellow-600";
		}
		if (certificate.pdf_file) {
			return isDark ? "text-green-400" : "text-green-600";
		}
		return isDark ? "text-gray-400" : "text-gray-600";
	}

	// Check if certificate can be downloaded
	static canDownloadCertificate(certificate: Certificate): boolean {
		return !!certificate.pdf_file && !certificate.pdf_generating;
	}

	// Export all certificates data (bypasses pagination)
	static async exportCertificates(
		format: "csv" | "json" = "csv",
		params: Omit<CertificatesQueryParams, "page" | "limit"> = {}
	): Promise<Blob> {
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("export_format", format);

		// Add filtering parameters (but not pagination)
		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.CERTIFICATES.EXPORT}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const blob = await apiClient.getBlob(url);

			return blob;
		} catch (error) {
			throw error;
		}
	}
}

// Export both class and instance for different usage patterns
export const certificatesService = new CertificatesService();
