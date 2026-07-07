import { makeAutoObservable } from "mobx";
import type {
	OcrExtractionResponse,
	OcrMatchesMap,
	OcrCaseMatch,
} from "../types/ocr.types";

/**
 * MobX store for OCR extraction metadata.
 *
 * Holds OCR-specific state (confidence scores, match candidates, processing status)
 * separately from the case form store. The actual form values are written
 * into CaseFormStore via its public actions — this store only tracks the
 * OCR extraction context.
 */
export class OcrResultStore {
	/** Raw extraction response from the API. */
	extractionResponse: OcrExtractionResponse | null = null;

	/** Whether an OCR upload is currently being processed. */
	isProcessing = false;

	/** Name of the file that was uploaded for OCR. */
	uploadedFileName: string | null = null;

	/** The uploaded file itself, retained so it can be stored against the case
	 * after creation (the police-form slot). Cleared on reset. */
	uploadedFile: File | null = null;

	/** Error message from the most recent OCR operation. */
	error: string | null = null;

	/** Per-field confidence scores. Cleared when the user edits a prefilled field. */
	fieldConfidence: Map<string, number> = new Map();

	/** Match candidates per entity type, for alternative selection. */
	matchCandidates: OcrMatchesMap | null = null;

	/** Case match result from police reference detection. */
	caseMatch: OcrCaseMatch | null = null;

	constructor() {
		makeAutoObservable(this);
	}

	// ============================================================================
	// COMPUTED
	// ============================================================================

	/** Whether any extracted field has a confidence score below 0.8. */
	get hasLowConfidenceFields(): boolean {
		if (this.fieldConfidence.size === 0) return false;
		for (const confidence of this.fieldConfidence.values()) {
			if (confidence < 0.8) return true;
		}
		return false;
	}

	/**
	 * Whether the entire extraction is unreliable.
	 * Returns true when all confidence scores are below 0.5,
	 * indicating the OCR output is too poor to be useful.
	 */
	get isUnreliableExtraction(): boolean {
		if (this.fieldConfidence.size === 0) return false;
		for (const confidence of this.fieldConfidence.values()) {
			if (confidence >= 0.5) return false;
		}
		return true;
	}

	// ============================================================================
	// ACTIONS
	// ============================================================================

	/** Update the processing state (e.g. while an upload is in flight). */
	setProcessing = (processing: boolean): void => {
		this.isProcessing = processing;
	};

	/** Populate the store with a successful extraction response. */
	setResult = (response: OcrExtractionResponse): void => {
		this.extractionResponse = response;
		this.error = null;
		this.isProcessing = false;
		this.matchCandidates = response.matches;
		this.caseMatch = response.case_match ?? null;

		// Build the per-field confidence map from the extraction data
		this.fieldConfidence.clear();
		const { extraction } = response;

		this.fieldConfidence.set("date", extraction.date.confidence);
		this.fieldConfidence.set(
			"seizure_date",
			extraction.seizure_date.confidence
		);
		this.fieldConfidence.set(
			"security_movement_envelope",
			extraction.security_movement_envelope.confidence
		);
		this.fieldConfidence.set(
			"division_unit",
			extraction.division_unit.confidence
		);
		this.fieldConfidence.set(
			"defendant_name",
			extraction.defendant_name.confidence
		);
		this.fieldConfidence.set(
			"conveying_officer_name",
			extraction.conveying_officer.name.confidence
		);
		this.fieldConfidence.set(
			"conveying_officer_badge",
			extraction.conveying_officer.badge_number.confidence
		);
		this.fieldConfidence.set(
			"on_behalf_of_officer_name",
			extraction.on_behalf_of_officer.name.confidence
		);
		this.fieldConfidence.set(
			"on_behalf_of_officer_badge",
			extraction.on_behalf_of_officer.badge_number.confidence
		);
	};

	/** Record an error from a failed OCR operation. */
	setError = (errorMessage: string): void => {
		this.error = errorMessage;
		this.isProcessing = false;
	};

	/** Remove the confidence indicator for a single field (e.g. after user edits it). */
	clearFieldConfidence = (fieldName: string): void => {
		this.fieldConfidence.delete(fieldName);
	};

	/** Reset the store to its initial empty state. */
	clearAll = (): void => {
		this.extractionResponse = null;
		this.isProcessing = false;
		this.uploadedFileName = null;
		this.uploadedFile = null;
		this.error = null;
		this.fieldConfidence.clear();
		this.matchCandidates = null;
		this.caseMatch = null;
	};
}

/** Singleton instance for use across the application. */
export const ocrResultStore = new OcrResultStore();
