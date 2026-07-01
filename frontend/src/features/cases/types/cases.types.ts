// Case domain types — matches Django Case model and serializers

import type { PaginatedResponse } from "@/shared/types/backend-api.types";
import type { UserTiny } from "@/shared/types/backend-api.types";
import type {
	PoliceOfficerTiny,
	PoliceStationTiny,
} from "@/features/police/types/police.types";
import type { DefendantTiny } from "@/features/defendants/types/defendants.types";
import type { Certificate } from "@/features/certificates/types/certificates.types";
import type { DrugBag } from "./drugBags.types";

// Case phase choices (matches Case.PhaseChoices in Django)
// 5-phase workflow
export type CasePhase =
	"assessment" | "unsigned_generation" | "batching" | "in_batch" | "complete";

// Phase history entry (matches CasePhaseHistorySerializer)
export interface PhaseHistoryEntry {
	id: number;
	from_phase: CasePhase;
	from_phase_display: string;
	to_phase: CasePhase;
	to_phase_display: string;
	action: "advance";
	action_display: string;
	user: number | null;
	user_details: UserTiny | null;
	timestamp: string;
	created_at: string;
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

	// Batching
	batch_id: number | null;
	batch_number: string | null;
	batch_invoice_raised_number: string | null;
	is_batch_eligible: boolean;

	// Phase history (audit trail of all phase transitions)
	phase_history: PhaseHistoryEntry[];

	// Computed properties
	cannabis_present: boolean;
	bags_received: number;
	total_plants: number;

	// Workflow timestamps
	certificates_generated_at: string | null;
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
	requesting_officer_name: string | null;
	submitting_officer_name: string | null;
	bags_count: number;
	certificates_count: number;
	defendants_count: number;
	cannabis_present: boolean;
	certificate_id: number | null;
	batch_id: number | null;
	batch_number: string | null;
	batch_invoice_raised_number: string | null;
	is_batch_eligible: boolean;
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
	officer?: number;
	station?: number;
	finance?: number;
	cannabis_only?: boolean;
	date_from?: string;
	date_to?: string;
	tag_search?: string;
	full?: boolean;
	page?: number;
	limit?: number;
	offset?: number;
	ordering?: string;
}

// Workflow action request
export type WorkflowAction = "advance_phase" | "generate_certificate";

export interface WorkflowActionRequest {
	action: WorkflowAction;
	groups?: number[][];
	/** Per-certificate Section C notes, aligned by index with groups */
	group_notes?: string[];
}

// Workflow action response
export interface WorkflowActionResponse {
	message: string;
	new_phase?: CasePhase;
	certificate_numbers?: string[];
}
