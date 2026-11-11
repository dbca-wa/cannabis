// Certificate domain types — matches Django Certificate model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";

// Certificate (matches CertificateSerializer)
// A certificate belongs to exactly one Priority 3 form; its case, defendants,
// and covered bags are reached through that form.
export interface Certificate {
	id: number;
	certificate_number: string;
	/** The Priority 3 form this certificate belongs to */
	form: number;
	/** Owning case, derived via the form */
	case_id: number | null;
	case_number: string | null;
	defendant_names: string | null;
	// The drug bags this certificate covers (max 5), from the form's bags
	bag_ids: number[];
	/** Batch this certificate belongs to, if any */
	batch_id: number | null;
	batch_number: string | null;
	/** True when the form's certificate is eligible to join a batch */
	is_batch_eligible: boolean;
	certified_date: string | null;
	/** Section C notes specific to this certificate */
	additional_notes: string | null;
	pdf_generating: boolean;
	pdf_file: string | null;
	pdf_url: string | null;
	pdf_size: number;
	/**
	 * True when the PDF no longer matches its case for a reason only the
	 * backend can see: older certificate wording, officer text that has
	 * changed (a different officer, an edited officer record or a changed
	 * print option), or other printed details such as the defendant or police
	 * reference. Never true for a batched certificate (see needs_repackage).
	 */
	needs_regeneration?: boolean;
	regeneration_reasons?: Array<"wording" | "officers" | "details">;
	/**
	 * True when a batched certificate's case changed after it was packaged.
	 * Re-packaging the batch brings it up to date. Never true for
	 * certificates packaged before this was tracked.
	 */
	needs_repackage?: boolean;
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
