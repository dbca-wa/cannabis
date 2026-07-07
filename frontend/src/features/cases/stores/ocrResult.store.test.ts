import { describe, it, expect, beforeEach } from "vitest";
import { OcrResultStore } from "./ocrResult.store";
import type { OcrExtractionResponse } from "../types/ocr.types";

/** Build a minimal valid extraction response for testing. */
const buildExtractionResponse = (
	caseMatchOverrides: Partial<OcrExtractionResponse["case_match"]> = {}
): OcrExtractionResponse => ({
	extraction: {
		date: { value: "2024-01-15", confidence: 0.95 },
		seizure_date: { value: "2024-01-14", confidence: 0.9 },
		security_movement_envelope: { value: "ENV-001", confidence: 0.88 },
		division_unit: { value: "Drug Squad", confidence: 0.92 },
		defendant_name: { value: "Smith, John", confidence: 0.85 },
		conveying_officer: {
			name: { value: "Constable Brown", confidence: 0.9 },
			badge_number: { value: "12345", confidence: 0.95 },
		},
		on_behalf_of_officer: {
			name: { value: "Sgt. Green", confidence: 0.87 },
			badge_number: { value: "67890", confidence: 0.93 },
		},
		items: [],
	},
	matches: {
		conveying_officer: { candidates: [], match_type: "none" },
		on_behalf_of_officer: { candidates: [], match_type: "none" },
		station: { candidates: [], match_type: "none" },
		defendant: { candidates: [], match_type: "none" },
	},
	case_match: {
		matched: false,
		case_id: null,
		case_number: null,
		...caseMatchOverrides,
	},
});

describe("OcrResultStore", () => {
	let store: OcrResultStore;

	beforeEach(() => {
		store = new OcrResultStore();
	});

	describe("setResult — case match populated when matched", () => {
		it("populates caseMatch when response.case_match.matched is true", () => {
			const response = buildExtractionResponse({
				matched: true,
				case_id: 42,
				case_number: "POL-2024-007",
			});

			store.setResult(response);

			expect(store.caseMatch).toEqual({
				matched: true,
				case_id: 42,
				case_number: "POL-2024-007",
			});
		});
	});

	describe("setResult — caseMatch.matched is false when no match", () => {
		it("sets caseMatch with matched false when there is no match", () => {
			const response = buildExtractionResponse({
				matched: false,
				case_id: null,
				case_number: null,
			});

			store.setResult(response);

			expect(store.caseMatch).toEqual({
				matched: false,
				case_id: null,
				case_number: null,
			});
		});
	});

	describe("clearAll — resets caseMatch to null", () => {
		it("resets caseMatch to null after clearing", () => {
			// First populate the store
			const response = buildExtractionResponse({
				matched: true,
				case_id: 10,
				case_number: "REF-123",
			});
			store.setResult(response);
			expect(store.caseMatch).not.toBeNull();

			// Then clear
			store.clearAll();

			expect(store.caseMatch).toBeNull();
			expect(store.extractionResponse).toBeNull();
			expect(store.matchCandidates).toBeNull();
			expect(store.isProcessing).toBe(false);
			expect(store.error).toBeNull();
		});
	});
});
