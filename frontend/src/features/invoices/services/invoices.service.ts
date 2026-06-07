import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Invoice,
	InvoiceCreateRequest,
	PaginatedInvoicesResponse,
	InvoiceSearchParams,
} from "@/shared/types/backend-api.types";
import { buildQueryParams } from "@/shared/utils/queryParams.utils";

export interface InvoicesQueryParams {
	page?: number;
	search?: string;
	case?: number;
	ordering?: string;
	limit?: number;
}

/** Get paginated list of invoices */
export const getInvoices = async (
	params: InvoicesQueryParams = {}
): Promise<PaginatedInvoicesResponse> => {
	const cleanParams = buildQueryParams({
		page: params.page,
		search: params.search,
		case: params.case,
		ordering: params.ordering,
		limit: params.limit,
	});

	return apiClient.get<PaginatedInvoicesResponse>(ENDPOINTS.INVOICES.LIST, {
		params: cleanParams,
	});
};

/** Get a single invoice by ID */
export const getInvoiceById = async (id: number): Promise<Invoice> => {
	return apiClient.get<Invoice>(ENDPOINTS.INVOICES.DETAIL(id));
};

/** Create a new invoice */
export const createInvoice = async (
	data: InvoiceCreateRequest
): Promise<Invoice> => {
	return apiClient.post<Invoice>(ENDPOINTS.INVOICES.CREATE, data);
};

/** Update an existing invoice */
export const updateInvoice = async (
	id: number,
	data: Partial<InvoiceCreateRequest>
): Promise<Invoice> => {
	return apiClient.patch<Invoice>(ENDPOINTS.INVOICES.UPDATE(id), data);
};

/** Delete an invoice */
export const deleteInvoice = async (id: number): Promise<void> => {
	await apiClient.delete(ENDPOINTS.INVOICES.DELETE(id));
};

/** Search invoices */
export const searchInvoices = async (
	params: InvoiceSearchParams
): Promise<PaginatedInvoicesResponse> => {
	const cleanParams = buildQueryParams({
		search: params.search,
		case: params.case,
		ordering: params.ordering,
		limit: params.limit,
		offset: params.offset,
	});

	return apiClient.get<PaginatedInvoicesResponse>(ENDPOINTS.INVOICES.LIST, {
		params: cleanParams,
	});
};

/** Download invoice PDF */
export const downloadInvoice = async (id: number): Promise<Blob> => {
	return apiClient.getBlob(ENDPOINTS.INVOICES.DOWNLOAD(id));
};
