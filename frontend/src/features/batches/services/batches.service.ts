import { apiClient } from "@/shared/services/api";
import { API_CONFIG } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type {
	Batch,
	BatchDetail,
	BatchOrdering,
	CreateBatchRequest,
	RecordInvoiceRaisedRequest,
} from "../types/batches.types";

/** List all batches, optionally sorted. */
export const getBatches = async (
	ordering: BatchOrdering = "-created_at"
): Promise<Batch[]> => {
	const params = new URLSearchParams({ ordering });
	return apiClient.get<Batch[]>(
		`${ENDPOINTS.BATCHES.LIST}?${params.toString()}`
	);
};

/** Retrieve a single batch with its cases and cost breakdown. */
export const getBatch = async (id: number): Promise<BatchDetail> => {
	return apiClient.get<BatchDetail>(ENDPOINTS.BATCHES.DETAIL(id));
};

/** Create a batch from the selected eligible cases. */
export const createBatch = async (
	payload: CreateBatchRequest
): Promise<BatchDetail> => {
	return apiClient.post<BatchDetail>(ENDPOINTS.BATCHES.CREATE, payload);
};

/** Record a unique invoice-raised number, completing the batch's cases. */
export const recordInvoiceRaised = async (
	id: number,
	payload: RecordInvoiceRaisedRequest
): Promise<BatchDetail> => {
	return apiClient.post<BatchDetail>(
		ENDPOINTS.BATCHES.INVOICE_RAISED(id),
		payload
	);
};

/** Clear the invoice-raised number, returning the batch's cases to In Batch. */
export const unsetInvoiceRaised = async (id: number): Promise<BatchDetail> => {
	return apiClient.delete<BatchDetail>(ENDPOINTS.BATCHES.INVOICE_RAISED(id));
};

/** Delete a batch, returning its cases to the batching phase. */
export const deleteBatch = async (id: number): Promise<void> => {
	return apiClient.delete(ENDPOINTS.BATCHES.DELETE(id));
};

/** Download the batch ZIP (certificates + cost summary). */
export const downloadBatchZip = async (id: number): Promise<Blob> => {
	return apiClient.getBlob(ENDPOINTS.BATCHES.DOWNLOAD(id));
};

/** Rebuild the batch package with latest templates. */
export const repackageBatch = async (id: number): Promise<void> => {
	await apiClient.post(ENDPOINTS.BATCHES.REPACKAGE(id), {});
};

/** Absolute URL for the batches CSV export. */
export const getBatchExportUrl = (): string =>
	`${API_CONFIG.BASE_URL}${ENDPOINTS.BATCHES.EXPORT}`;
