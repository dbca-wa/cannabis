// Submission workflow types that match Django models exactly
// This file contains all submission, drug bag, and botanical assessment types

// Forward declarations to avoid circular imports
// These will be properly typed when imported through the main index.ts
export interface UserTiny {
	id: number;
	email: string;
	first_name: string | null;
	last_name: string | null;
	full_name: string;
	initials: string;
	role: string;
	role_display: string;
	is_active: boolean;
	is_staff: boolean;
	is_superuser: boolean;
	date_joined: string;
	last_login: string | null;
}

export interface PoliceOfficerTiny {
	id: number;
	badge_number: string | null;
	first_name: string | null;
	last_name: string | null;
	full_name: string;
	rank: string;
	rank_display: string;
	station: number | null;
	station_name: string | null;
	is_sworn: boolean;
}

export interface PoliceStationTiny {
	id: number;
	name: string;
	phone: string | null;
}

export interface DefendantTiny {
	id: number;
	first_name: string | null;
	last_name: string;
	full_name: string;
	cases_count: number;
}

export interface Certificate {
	id: number;
	certificate_number: string;
	submission?: number;
	pdf_generating: boolean;
	pdf_file: string | null;
	pdf_url: string | null;
	pdf_size: number;
	created_at: string;
	updated_at: string;
	submission_case_number?: string;
	defendant_names?: string;
}

export interface Invoice {
	id: number;
	invoice_number: string;
	submission?: number;
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
	submission_case_number?: string;
	defendant_names?: string;
}

export interface AdditionalInvoiceFee {
	id: number;
	invoice?: number;
	claim_kind: string;
	claim_kind_display: string;
	units: number;
	description: string | null;
	calculated_cost: string;
	created_at: string;
	updated_at: string;
}

// ============================================================================
// SUBMISSIONS TYPES (matches Django Submission, DrugBag, and BotanicalAssessment models)
// ============================================================================

// Submission phase choices (matches Submission.PhaseChoices in Django)
// NEW 6-PHASE WORKFLOW (updated from 8 phases)
export type SubmissionPhase =
	| "data_entry"
	| "finance_approval"
	| "botanist_review"
	| "documents"
	| "send_emails"
	| "complete";

// Phase history entry (matches SubmissionPhaseHistorySerializer)
export interface PhaseHistoryEntry {
	id: number;
	from_phase: SubmissionPhase;
	from_phase_display: string; // Human-readable display name
	to_phase: SubmissionPhase;
	to_phase_display: string; // Human-readable display name
	action: "advance" | "send_back";
	action_display: string; // Human-readable display name
	user: number | null; // User ID who performed the action
	user_details: UserTiny | null; // Nested user object
	reason: string | null; // Reason for send-back actions (null for advances)
	timestamp: string; // ISO datetime string
	created_at: string; // ISO datetime string
}

// Send-back request (for POST /api/v1/submissions/{id}/send-back/)
export interface SendBackRequest {
	target_phase: SubmissionPhase;
	reason: string;
}

// Send-back response
export interface SendBackResponse {
	message: string;
	new_phase: SubmissionPhase;
	sent_back_by: string;
	sent_back_at: string; // ISO datetime string
	reason: string;
}

// Drug bag content type choices (matches DrugBag.ContentType in Django)
export type DrugBagContentType =
	| "plant"
	| "plant_material"
	| "cutting"
	| "stalk"
	| "stem"
	| "seed"
	| "seed_material"
	| "unknown_seed"
	| "seedling"
	| "head"
	| "rootball"
	| "poppy"
	| "poppy_plant"
	| "poppy_capsule"
	| "poppy_head"
	| "poppy_seed"
	| "mushroom"
	| "tablet"
	| "unknown"
	| "unsure";

// Botanical assessment determination choices (matches BotanicalAssessment.DeterminationChoices)
export type BotanicalDetermination =
	| "pending"
	| "cannabis_sativa"
	| "cannabis_indica"
	| "cannabis_hybrid"
	| "mixed"
	| "papaver_somniferum"
	| "degraded"
	| "not_cannabis"
	| "unidentifiable"
	| "inconclusive";

// Botanical Assessment (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessment {
	id: number;
	determination: BotanicalDetermination | null;
	determination_display: string; // Computed field from get_determination_display()
	is_cannabis: boolean; // Computed property
	assessment_date: string | null; // ISO datetime string
	botanist_notes: string | null;
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Drug Bag (matches DrugBagSerializer)
export interface DrugBag {
	id: number;
	content_type: DrugBagContentType;
	content_type_display: string; // Computed field from get_content_type_display()
	seal_tag_numbers: string;
	new_seal_tag_numbers: string | null;
	property_reference: string | null;
	gross_weight: string | null; // DecimalField as string
	net_weight: string | null; // DecimalField as string
	security_movement_envelope: string; // Computed property from submission
	assessment: BotanicalAssessment | null; // Nested assessment
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Complete Submission (matches SubmissionSerializer)
export interface Submission {
	id: number;
	case_number: string;
	received: string; // ISO datetime string
	phase: SubmissionPhase;
	phase_display: string; // Computed field from get_phase_display()
	security_movement_envelope: string;
	internal_comments: string | null;
	is_draft: boolean; // Whether this is a draft submission

	// Finance fields (for invoice calculation)
	forensic_hours: string | null; // DecimalField as string
	fuel_distance_km: string | null; // DecimalField as string

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
	defendants: number[]; // Array of defendant IDs
	defendants_details: DefendantTiny[]; // Array of nested defendant objects

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
	finance_approved_at: string | null; // ISO datetime string
	botanist_approved_at: string | null; // ISO datetime string
	documents_generated_at: string | null; // ISO datetime string (renamed from certificates_generated_at)
	emails_sent_at: string | null; // ISO datetime string
	completed_at: string | null; // ISO datetime string

	// Audit fields
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
}

// Lightweight Submission for lists (matches SubmissionListSerializer)
export interface SubmissionTiny {
	id: number;
	case_number: string;
	phase: SubmissionPhase;
	phase_display: string;
	received: string; // ISO datetime string
	approved_botanist_name: string | null;
	finance_officer_name: string | null;
	requesting_officer_name: string | null;
	bags_count: number; // Computed field
	defendants_count: number; // Computed field
	cannabis_present: boolean; // Computed property
	created_at: string; // ISO datetime string
}

// Submission creation request (matches SubmissionCreateSerializer)
export interface SubmissionCreateRequest {
	case_number: string;
	received: string; // ISO datetime string
	security_movement_envelope: string;
	requesting_officer?: number | null;
	submitting_officer?: number | null;
	defendants?: number[]; // Array of defendant IDs
	is_draft?: boolean; // Whether this is a draft submission (defaults to true)
}

// Submission update request (matches SubmissionUpdateSerializer)
export interface SubmissionUpdateRequest {
	approved_botanist?: number | null;
	finance_officer?: number | null;
	internal_comments?: string | null;
	defendants?: number[]; // Array of defendant IDs
	phase?: SubmissionPhase;
}

// Drug bag creation request (matches DrugBagCreateSerializer)
export interface DrugBagCreateRequest {
	submission: number;
	content_type: DrugBagContentType;
	seal_tag_numbers: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null; // DecimalField as string
	net_weight?: string | null; // DecimalField as string
}

// Drug bag update request (partial update)
export interface DrugBagUpdateRequest {
	content_type?: DrugBagContentType;
	seal_tag_numbers?: string;
	new_seal_tag_numbers?: string | null;
	property_reference?: string | null;
	gross_weight?: string | null; // DecimalField as string
	net_weight?: string | null; // DecimalField as string
}

// Botanical assessment creation/update request (matches BotanicalAssessmentSerializer)
export interface BotanicalAssessmentRequest {
	determination?: BotanicalDetermination | null;
	assessment_date?: string | null; // ISO datetime string
	botanist_notes?: string | null;
}

// Submissions search parameters
export interface SubmissionsSearchParams {
	search?: string; // Search case number, officer names, defendant names
	phase?: SubmissionPhase; // Filter by workflow phase
	botanist?: number; // Filter by assigned botanist ID
	finance?: number; // Filter by assigned finance officer ID
	cannabis_only?: boolean; // Show only submissions with cannabis present
	date_from?: string; // Filter by received date (from) - ISO date string
	date_to?: string; // Filter by received date (to) - ISO date string
	full?: boolean; // Return full serializer instead of list serializer
	limit?: number;
	offset?: number;
	ordering?: string; // Sort field (e.g., "-received", "case_number")
}

// Workflow action request
export interface WorkflowActionRequest {
	action: "advance_phase" | "generate_certificate" | "generate_invoice";
	customer_number?: string; // Required for generate_invoice action
}

// Workflow action response
export interface WorkflowActionResponse {
	message: string;
	new_phase?: SubmissionPhase;
	certificate_number?: string;
	invoice_number?: string;
	total?: string;
}

// Forward declaration to avoid circular imports
export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

// Paginated submissions response
export interface PaginatedSubmissionsResponse
	extends PaginatedResponse<SubmissionTiny> {}

// Paginated drug bags response
export interface PaginatedDrugBagsResponse extends PaginatedResponse<DrugBag> {}

// Submissions table filter preferences
export interface SubmissionsTableFilterPreferences {
	searchQuery?: string;
	phase?: SubmissionPhase | "all";
	botanist?: number | "all";
	finance?: number | "all";
	dateFrom?: string;
	dateTo?: string;
	cannabisOnly?: boolean;
	sortField?: string;
	sortDirection?: "asc" | "desc";
}