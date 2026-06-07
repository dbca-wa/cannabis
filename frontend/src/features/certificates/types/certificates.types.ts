// Certificate domain types — matches Django Certificate model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

// Certificate (matches CertificateSerializer)
export interface Certificate {
	id: number;
	certificate_number: string;
	case?: number;
	pdf_generating: boolean;
	pdf_file: string | null;
	pdf_url: string | null;
	pdf_size: number;
	signed_pdf_file?: string | null;
	signed_pdf_url?: string | null;
	signed_pdf_size?: number;
	is_locked?: boolean;
	locked_at?: string | null;
	created_at: string;
	updated_at: string;
	// Signing metadata
	signature_used_id?: number | null;
	signed_by?: number | null;
	signature_embedded_at?: string | null;
	file_hash_at_signing?: string | null;
	// Additional context data (optional)
	submission_case_number?: string;
	defendant_names?: string;
}

// Certificate creation request
export interface CertificateCreateRequest {
	case: number;
}

// Paginated certificate response
export type PaginatedCertificatesResponse = PaginatedResponse<Certificate>;

// Certificate search parameters
export interface CertificateSearchParams {
	search?: string;
	case?: number;
	ordering?: string;
	limit?: number;
	offset?: number;
}
