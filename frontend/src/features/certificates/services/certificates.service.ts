import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Certificate,
	CertificateCreateRequest,
	PaginatedCertificatesResponse,
	CertificateSearchParams,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";

export interface CertificatesQueryParams {
	page?: number;
	search?: string;
	case?: number;
	ordering?: string;
	limit?: number;
}

/** Get paginated list of certificates */
export const getCertificates = async (
	params: CertificatesQueryParams = {}
): Promise<PaginatedCertificatesResponse> => {
	const cleanParams = buildQueryParams({
		page: params.page,
		search: params.search,
		case: params.case,
		ordering: params.ordering,
		limit: params.limit,
	});

	const searchParams = new URLSearchParams();
	Object.entries(cleanParams).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((v) => searchParams.append(key, String(v)));
		} else {
			searchParams.append(key, String(value));
		}
	});

	const url = `${ENDPOINTS.CERTIFICATES.LIST}${
		searchParams.toString() ? `?${searchParams.toString()}` : ""
	}`;

	return apiClient.get<PaginatedCertificatesResponse>(url);
};

/** Get a single certificate by ID */
export const getCertificateById = async (id: number): Promise<Certificate> => {
	return apiClient.get<Certificate>(ENDPOINTS.CERTIFICATES.DETAIL(id));
};

/** Create a new certificate */
export const createCertificate = async (
	data: CertificateCreateRequest
): Promise<Certificate> => {
	return apiClient.post<Certificate>(ENDPOINTS.CERTIFICATES.CREATE, data);
};

/** Update a certificate */
export const updateCertificate = async (
	id: number,
	data: Partial<CertificateCreateRequest>
): Promise<Certificate> => {
	return apiClient.put<Certificate>(ENDPOINTS.CERTIFICATES.UPDATE(id), data);
};

/** Delete a certificate */
export const deleteCertificate = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.CERTIFICATES.DELETE(id));
};

/** Search certificates */
export const searchCertificates = async (
	params: CertificateSearchParams
): Promise<PaginatedCertificatesResponse> => {
	const cleanParams = buildQueryParams({
		search: params.search,
		case: params.case,
		ordering: params.ordering,
		limit: params.limit,
		offset: params.offset,
	});

	const searchParams = new URLSearchParams();
	Object.entries(cleanParams).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((v) => searchParams.append(key, String(v)));
		} else {
			searchParams.append(key, String(value));
		}
	});

	const url = `${ENDPOINTS.CERTIFICATES.LIST}${
		searchParams.toString() ? `?${searchParams.toString()}` : ""
	}`;

	return apiClient.get<PaginatedCertificatesResponse>(url);
};

/** Download certificate PDF */
export const downloadCertificate = async (id: number): Promise<Blob> => {
	return apiClient.getBlob(ENDPOINTS.CERTIFICATES.DOWNLOAD(id));
};
