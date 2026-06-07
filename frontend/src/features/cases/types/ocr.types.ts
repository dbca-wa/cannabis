/** Extracted field value with raw text and OCR confidence. */
export interface OcrFieldValue {
	value: string | number | null;
	raw_text?: string;
	confidence: number;
}

/** Officer name and badge number extracted from the form. */
export interface OcrExtractedOfficer {
	name: OcrFieldValue;
	badge_number: OcrFieldValue;
}

/** A single row from the items table. */
export interface OcrExtractedItem {
	property_reference: OcrFieldValue;
	quantity: OcrFieldValue;
	item_description: OcrFieldValue;
	item_type: OcrFieldValue;
	seal_number: OcrFieldValue;
	new_seal_number: OcrFieldValue;
	mapped_content_type: string;
}

/** All structured fields extracted from a police form. */
export interface OcrExtraction {
	date: OcrFieldValue;
	seizure_date: OcrFieldValue;
	security_movement_envelope: OcrFieldValue;
	conveying_officer: OcrExtractedOfficer;
	on_behalf_of_officer: OcrExtractedOfficer;
	division_unit: OcrFieldValue;
	defendant_name: OcrFieldValue;
	items: OcrExtractedItem[];
}

/** A database record that potentially matches an extracted entity. */
export interface OcrMatchCandidate {
	id: number;
	similarity: number;
	display_data: Record<string, string | number | null>;
}

/** Entity matching result with ranked candidates. */
export interface OcrMatchResult {
	candidates: OcrMatchCandidate[];
	match_type: "exact_badge" | "fuzzy_name" | "none";
}

/** Match results for all entity types. */
export interface OcrMatchesMap {
	conveying_officer: OcrMatchResult;
	on_behalf_of_officer: OcrMatchResult;
	station: OcrMatchResult;
	defendant: OcrMatchResult;
}

/** Complete API response from the OCR upload endpoint. */
export interface OcrExtractionResponse {
	extraction: OcrExtraction;
	matches: OcrMatchesMap;
}
