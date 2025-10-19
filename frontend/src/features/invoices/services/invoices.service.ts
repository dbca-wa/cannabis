import { apiClient, ENDPOINTS } from "@/shared/services/api";
import type {
	Invoice,
	InvoiceCreateRequest,
	PaginatedInvoicesResponse,
	InvoiceSearchParams,
} from "@/shared/types/backend-api.types";

export interface InvoicesQueryParams {
	page?: number;
	search?: string;
	submission?: number;
	ordering?: string;
	limit?: number;
}

export class InvoicesService {
	/**
	 * Get paginated list of invoices
	 */
	static async getInvoices(
		params: InvoicesQueryParams = {}
	): Promise<PaginatedInvoicesResponse> {
		const searchParams = new URLSearchParams();

		if (params.page) searchParams.append("page", params.page.toString());
		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());

		const url = `${ENDPOINTS.INVOICES.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedInvoicesResponse>(url);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get a single invoice by ID
	 */
	static async getInvoiceById(id: number): Promise<Invoice> {
		try {
			const result = await apiClient.get<Invoice>(
				ENDPOINTS.INVOICES.DETAIL(id)
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Create a new invoice
	 */
	static async createInvoice(data: InvoiceCreateRequest): Promise<Invoice> {
		try {
			const result = await apiClient.post<Invoice>(
				ENDPOINTS.INVOICES.CREATE,
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Update an existing invoice
	 */
	static async updateInvoice(
		id: number,
		data: Partial<InvoiceCreateRequest>
	): Promise<Invoice> {
		try {
			const result = await apiClient.patch<Invoice>(
				ENDPOINTS.INVOICES.UPDATE(id),
				data
			);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Delete an invoice
	 */
	static async deleteInvoice(id: number): Promise<void> {
		try {
			await apiClient.delete(ENDPOINTS.INVOICES.DELETE(id));
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Search invoices with debounced functionality
	 */
	static async searchInvoices(
		params: InvoiceSearchParams
	): Promise<PaginatedInvoicesResponse> {
		const searchParams = new URLSearchParams();

		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);
		if (params.limit) searchParams.append("limit", params.limit.toString());
		if (params.offset)
			searchParams.append("offset", params.offset.toString());

		const url = `${ENDPOINTS.INVOICES.LIST}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		try {
			const result = await apiClient.get<PaginatedInvoicesResponse>(url);

			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Download invoice PDF
	 */
	static async downloadInvoice(id: number): Promise<Blob> {
		try {
			const blob = await apiClient.getBlob(
				ENDPOINTS.INVOICES.DOWNLOAD(id)
			);

			return blob;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Format invoice display name for UI components
	 */
	static formatInvoiceDisplayName(invoice: Invoice): string {
		return invoice.invoice_number;
	}

	/**
	 * Get invoice status badge text
	 */
	static getInvoiceStatusBadge(invoice: Invoice): string {
		if (invoice.pdf_generating) return "Generating";
		if (invoice.pdf_file) return "Generated";
		return "Pending";
	}

	/**
	 * Get invoice status badge color class
	 */
	static getInvoiceStatusBadgeColorClass(
		invoice: Invoice,
		isDark: boolean = false
	): string {
		if (invoice.pdf_generating) {
			return isDark ? "text-yellow-400" : "text-yellow-600";
		}
		if (invoice.pdf_file) {
			return isDark ? "text-green-400" : "text-green-600";
		}
		return isDark ? "text-gray-400" : "text-gray-600";
	}

	/**
	 * Check if invoice can be downloaded
	 */
	static canDownloadInvoice(invoice: Invoice): boolean {
		return !!invoice.pdf_file && !invoice.pdf_generating;
	}

	/**
	 * Format invoice total amount for display
	 */
	static formatInvoiceTotal(invoice: Invoice): string {
		const total = parseFloat(invoice.total);
		return new Intl.NumberFormat("en-AU", {
			style: "currency",
			currency: "AUD",
		}).format(total);
	}

	/**
	 * Export all invoices data (bypasses pagination)
	 */
	static async exportInvoices(
		format: "csv" | "json" = "csv",
		params: Omit<InvoicesQueryParams, "page" | "limit"> = {}
	): Promise<Blob> {
		const searchParams = new URLSearchParams();

		// Add format parameter
		searchParams.append("export_format", format);

		// Add filtering parameters (but not pagination)
		if (params.search) searchParams.append("search", params.search);
		if (params.submission)
			searchParams.append("submission", params.submission.toString());
		if (params.ordering) searchParams.append("ordering", params.ordering);

		const url = `${ENDPOINTS.INVOICES.EXPORT}${
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
export const invoicesService = new InvoicesService();