// Case domain types — matches Django Case model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";
import type { UserTiny } from "@/shared/types/backend-api.types";
import type {
	PoliceOfficerTiny,
	PoliceStationTiny,
} from "@/features/police/types/police.types";
import type { DefendantTiny } from "@/features/defendants/types/defendants.types";
import type { Certificate } from "@/features/certificates/types/certificates.types";
import type {
	Invoice,
	AdditionalInvoiceFee,
} from "@/features/invoices/types/invoices.types";
import type { DrugBag } from "./drugBags.types";

// Case phase choices (matches Case.PhaseChoices in Django)
// 8-PHASE WORKFLOW
export type CasePhase =
	| "data_entry"
	| "finance_approval"
	| "botanist_review"
	| "documents"
	| "botanist_signoff"
	| "invoicing"
	| "send_emails"
	| "complete";

// Phase history entry (matches CasePhaseHistorySerializer)
export interface PhaseHistoryEntry {
	id: number;
	from_phase: CasePhase;
	from_phase_display: string;
	to_phase: CasePhase;
	to_phase_display: string;
	action: "advance" | "send_back";
	action_display: string;
	user: number | null;
	user_details: UserTiny | null;
	reason: string | null;
	timestamp: string;
	created_at: string;
}

// Send-back request (for POST /cases/{id}/send-back/)
export interface SendBackRequest {
	target_phase: CasePhase;
	reason: string;
}

// Send-back response
export interface SendBackResponse {
	message: string;
	new_phase: CasePhase;
	sent_back_by: string;
	sent_back_at: string;
	reason: string;
}

// Complete Case (matches CaseSerializer)
export interface Case {
	id: number;
	case_number: string;
	received: string;
	phase: CasePhase;
	phase_display: string;
	security_movement_envelope: string;
	internal_comments: string | null;

	// Finance fields (for invoice calculation)
	forensic_hours: string | null;
	fuel_distance_km: string | null;

	// Staff assignments (foreign key IDs)
	approved_botanist: number | null;
	finance_officer: number | null;
	requesting_officer: number | null;
	submitting_officer: number | null;
	station: number | null;

	// Staff assignment details (nested objects)
	approved_botanist_details: UserTiny | null;
	finance_officer_details: UserTiny | null;
	requesting_officer_details: PoliceOfficerTiny | null;
	submitting_officer_details: PoliceOfficerTiny | null;
	station_details: PoliceStationTiny | null;

	// Defendants (many-to-many)
	defendants: number[];
	defendants_details: DefendantTiny[];

	// Related objects
	bags: DrugBag[];
	certificates: Certificate[];
	invoices: Invoice[];
	additional_fees: AdditionalInvoiceFee[];

	// Phase history (audit trail of all phase transitions)
	phase_history: PhaseHistoryEntry[];

	// Computed properties
	cannabis_present: boolean;
	bags_received: number;
	total_plants: number;

	// Workflow timestamps
	finance_approved_at: string | null;
	botanist_approved_at: string | null;
	documents_generated_at: string | null;
	certificates_generated_at: string | null;
	invoices_generated_at: string | null;
	emails_sent_at: string | null;
	completed_at: string | null;

	// Audit fields
	created_at: string;
	updated_at: string;
}

// Lightweight Case for lists (matches CaseListSerializer)
export interface CaseTiny {
	id: number;
	case_number: string;
	phase: CasePhase;
	phase_display: string;
	received: string;
	approved_botanist_name: string | null;
	finance_officer_name: string | null;
	requesting_officer_name: string | null;
	bags_count: number;
	defendants_count: number;
	cannabis_present: boolean;
	certificate_id: number | null;
	invoice_id: number | null;
	created_at: string;
}

// Case creation request (matches CaseCreateSerializer)
export interface CaseCreateRequest {
	case_number: string;
	received: string;
	security_movement_envelope: string;
	requesting_officer?: number | null;
	submitting_officer?: number | null;
	defendants?: number[];
}

// Case draft (matches CaseDraftSerializer — separate from cases)
export interface CaseDraft {
	id: number;
	data: Record<string, unknown>;
	current_step: number;
	created_at: string;
	updated_at: string;
}

// Case update request (matches CaseUpdateSerializer)
export interface CaseUpdateRequest {
	case_number?: string;
	received?: string;
	security_movement_envelope?: string;
	internal_comments?: string | null;
	forensic_hours?: string | null;
	fuel_distance_km?: string | null;
	approved_botanist?: number | null;
	finance_officer?: number | null;
	requesting_officer?: number | null;
	submitting_officer?: number | null;
	station?: number | null;
	defendants?: number[];
}

// Paginated cases response
export type PaginatedCasesResponse = PaginatedResponse<CaseTiny>;

// Case search parameters
export interface CaseSearchParams {
	search?: string;
	phase?: CasePhase;
	approved_botanist?: number;
	finance_officer?: number;
	requesting_officer?: number;
	submitting_officer?: number;
	station?: number;
	defendants?: number[];
	cannabis_present?: boolean;
	received_after?: string;
	received_before?: string;
	ordering?: string;
	limit?: number;
	offset?: number;
}

// Cases search parameters (alternative search interface)
export interface CasesSearchParams {
	search?: string;
	phase?: CasePhase;
	botanist?: number;
	finance?: number;
	cannabis_only?: boolean;
	date_from?: string;
	date_to?: string;
	full?: boolean;
	limit?: number;
	offset?: number;
	ordering?: string;
}

// Workflow action request
export interface WorkflowActionRequest {
	action: "advance_phase" | "generate_certificate" | "generate_invoice";
	customer_number?: string;
}

// Workflow action response
export interface WorkflowActionResponse {
	message: string;
	new_phase?: CasePhase;
	certificate_number?: string;
	invoice_number?: string;
	total?: string;
}
