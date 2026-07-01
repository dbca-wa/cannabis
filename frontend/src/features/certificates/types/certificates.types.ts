// Certificate domain types — matches Django Certificate model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

// Certificate (matches CertificateSerializer)
export interface Certificate {
	id: number;
	certificate_number: string;
	submission?: number;
	submission_case_number?: string;
	defendant_names?: string | null;
	// The drug bags this certificate covers (max 5)
	bag_ids: number[];
	certified_date: string | null;
	/** Section C notes specific to this certificate */
	additional_notes: string | null;
	pdf_generating: boolean;
	pdf_file: string | null;
	pdf_url: string | null;
	pdf_size: number;
	created_at: string;
	updated_at: string;
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
