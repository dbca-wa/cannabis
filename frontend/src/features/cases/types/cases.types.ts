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
// A case owns the shared base data for all of its Priority 3 forms. The
// workflow phase, drug bags, certificates, and scanned image now live on the
// forms, so the case exposes a derived status and per-case counts instead.
export interface Case {
	id: number;
	case_number: string;
	received: string;
	/** Aggregated status across the case's forms (least-advanced non-complete) */
	derived_status: CasePhase;
	derived_status_display: string;
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

	// Priority 3 forms — each owns its bags, scanned image, and certificate
	forms: Priority3Form[];

	// Phase history (audit trail of all phase transitions)
	phase_history: PhaseHistoryEntry[];

	// Per-case counts (derived from the case's forms)
	forms_count: number;
	bags_count: number;
	certificates_count: number;

	// Computed properties
	cannabis_present: boolean;
	bags_received: number;
	total_plants: number;

	// Audit fields
	created_at: string;
	updated_at: string;
}

// Lightweight Case for lists (matches CaseListSerializer)
export interface CaseTiny {
	id: number;
	case_number: string;
	derived_status: CasePhase;
	derived_status_display: string;
	received: string;
	requesting_officer_name: string | null;
	requesting_officer_rank: string | null;
	requesting_officer_station: string | null;
	submitting_officer_name: string | null;
	submitting_officer_rank: string | null;
	submitting_officer_station: string | null;
	station_name: string | null;
	certificate_id: number | null;
	// Each form's summary, including its single certificate and bag count
	forms: Priority3FormTiny[];
	forms_count: number;
	bags_count: number;
	certificates_count: number;
	defendants_count: number;
	defendant_names: string[];
	cannabis_present: boolean;
	created_at: string;
}

// Priority 3 form (matches Priority3FormSerializer)
// A form belongs to exactly one case, owns at most five drug bags and its own
// scanned image, and produces exactly one certificate.
export interface Priority3Form {
	id: number;
	case: number;
	scanned_image_url: string | null;
	security_movement_envelope: string;
	additional_notes: string | null;
	phase: CasePhase;
	phase_display: string;
	bags: DrugBag[];
	certificate: Certificate | null;
	marked_ready: boolean;
	certificates_generated_at: string | null;
	completed_at: string | null;
}

// Lightweight Priority 3 form for nesting in case listings
// (matches Priority3FormTinySerializer — bag count instead of the full bag list)
export interface Priority3FormTiny {
	id: number;
	case: number;
	scanned_image_url: string | null;
	security_movement_envelope: string;
	phase: CasePhase;
	phase_display: string;
	bags_count: number;
	certificate: Certificate | null;
	marked_ready: boolean;
	certificates_generated_at: string | null;
	completed_at: string | null;
}

// Priority 3 form creation request (matches Priority3FormSerializer writable fields)
export interface Priority3FormCreateRequest {
	security_movement_envelope?: string;
}

// Priority 3 form update request (partial update of the form's editable fields)
export interface Priority3FormUpdateRequest {
	security_movement_envelope?: string;
	additional_notes?: string | null;
	marked_ready?: boolean;
}

// Generate a form's single certificate (optional Section C note)
export interface FormCertificateGenerateRequest {
	section_c_note?: string | null;
}

// Advance a form to its next workflow phase
export interface FormWorkflowRequest {
	action: "advance_phase";
}

// Response from advancing a form's workflow phase
export interface FormWorkflowResponse {
	message: string;
	new_phase: CasePhase;
}

// Case creation request (matches CaseCreateSerializer — base data only)
export interface CaseCreateRequest {
	case_number: string;
	received: string;
	requesting_officer?: number | null;
	submitting_officer?: number | null;
	station?: number | null;
	approved_botanist?: number | null;
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

// Case update request (matches CaseUpdateSerializer — editable base data)
export interface CaseUpdateRequest {
	case_number?: string;
	received?: string;
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
