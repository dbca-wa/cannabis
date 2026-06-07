// Invoice domain types — matches Django Invoice model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

// Additional Invoice Fee type choices
export type InvoiceFeeType = "fuel" | "call_out" | "forensic";

// Additional Invoice Fee (matches AdditionalInvoiceFeeSerializer)
export interface AdditionalInvoiceFee {
	id: number;
	invoice?: number;
	claim_kind: InvoiceFeeType;
	claim_kind_display: string;
	units: number;
	description: string | null;
	calculated_cost: string;
	created_at: string;
	updated_at: string;
}

// Invoice (matches InvoiceSerializer)
export interface Invoice {
	id: number;
	invoice_number: string;
	case?: number;
	customer_number: string;
	subtotal: string;
	tax_amount: string;
	total: string;
	pdf_generating: boolean;
	pdf_file: string | null;
	pdf_url: string | null;
	pdf_size: number;
	additional_fees?: AdditionalInvoiceFee[];
	created_at: string;
	updated_at: string;
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Invoice creation request
export interface InvoiceCreateRequest {
	case: number;
	customer_number: string;
}

// Paginated invoice response
export type PaginatedInvoicesResponse = PaginatedResponse<Invoice>;

// Invoice search parameters
export interface InvoiceSearchParams {
	search?: string;
	case?: number;
	ordering?: string;
	limit?: number;
	offset?: number;
}
