// Certificate and invoice types that match Django models exactly
// This file contains all certificate, invoice, and fee-related types

// Forward declaration to avoid circular imports
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

// ============================================================================
// CERTIFICATE & INVOICE TYPES (matches Django Certificate and Invoice models)
// ============================================================================

// Certificate (matches CertificateSerializer)
export interface Certificate {
	id: number;
	certificate_number: string; // Auto-generated (e.g., CRT2024-001)
	submission?: number; // Submission ID (optional for context)
	pdf_generating: boolean;
	pdf_file: string | null; // File path
	pdf_url: string | null; // Full URL from serializer method
	pdf_size: number; // Size in bytes
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Additional Invoice Fee (matches AdditionalInvoiceFeeSerializer)
export type InvoiceFeeType = "fuel" | "call_out" | "forensic";

export interface AdditionalInvoiceFee {
	id: number;
	invoice?: number; // Invoice ID (optional for creation)
	claim_kind: InvoiceFeeType;
	claim_kind_display: string;
	units: number; // km for fuel, hours for forensic, times for call out
	description: string | null;
	calculated_cost: string; // Decimal as string
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Invoice (matches InvoiceSerializer)
export interface Invoice {
	id: number;
	invoice_number: string; // Auto-generated (e.g., INV2024-001)
	submission?: number; // Submission ID (optional for context)
	customer_number: string;
	subtotal: string; // Decimal as string
	tax_amount: string; // Decimal as string
	total: string; // Decimal as string
	pdf_generating: boolean;
	pdf_file: string | null; // File path
	pdf_url: string | null; // Full URL from serializer method
	pdf_size: number; // Size in bytes
	additional_fees?: AdditionalInvoiceFee[]; // Related fees
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Certificate creation request
export interface CertificateCreateRequest {
	submission: number; // Submission ID
}

// Invoice creation request
export interface InvoiceCreateRequest {
	submission: number; // Submission ID
	customer_number: string;
}

// Paginated certificate response
export interface PaginatedCertificatesResponse
	extends PaginatedResponse<Certificate> {}

// Paginated invoice response
export interface PaginatedInvoicesResponse extends PaginatedResponse<Invoice> {}

// Certificate search parameters
export interface CertificateSearchParams {
	search?: string; // Search by certificate number or case number
	submission?: number; // Filter by submission ID
	ordering?: string; // Sort order (e.g., '-created_at', 'certificate_number')
	limit?: number;
	offset?: number;
}

// Invoice search parameters
export interface InvoiceSearchParams {
	search?: string; // Search by invoice number or customer number
	submission?: number; // Filter by submission ID
	ordering?: string; // Sort order (e.g., '-created_at', 'invoice_number')
	limit?: number;
	offset?: number;
}

// Certificates table filter preferences
export interface CertificatesTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	// Can be extended for status filters, date range filters, etc.
}

// Invoices table filter preferences
export interface InvoicesTableFilterPreferences {
	sortField?: string;
	sortDirection?: "asc" | "desc";
	// Can be extended for status filters, amount range filters, etc.
}

// ============================================================================
// SYSTEM SETTINGS (for pricing configuration)
// ============================================================================

export interface SystemSettings {
	cost_per_certificate: string; // DecimalField as string
	cost_per_bag: string;
	call_out_fee: string;
	cost_per_forensic_hour: string;
	cost_per_kilometer_fuel: string;
	tax_percentage: string;
}