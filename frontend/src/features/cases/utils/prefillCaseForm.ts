import type { OcrExtractionResponse } from "../types/ocr.types";
import type { CaseFormStore } from "../stores/caseForm.store";
import type { OcrResultStore } from "../stores/ocrResult.store";
import type {
	PoliceOfficerTiny,
	PoliceStationTiny,
	DefendantTiny,
} from "@/shared/types/backend-api.types";

/**
 * Populate the case form with data extracted from an OCR scan.
 *
 * Bridges the OcrExtractionResponse to CaseFormStore actions.
 * For entity fields (officers, station, defendant), the top-scoring
 * match candidate is auto-selected. Multi-candidate matches are
 * flagged for user review in the OcrResultStore.
 */
export const prefillCaseForm = (
	response: OcrExtractionResponse,
	formStore: CaseFormStore,
	_ocrStore: OcrResultStore
): void => {
	const { extraction, matches } = response;

	console.log("[OCR Prefill] Starting prefill with extraction:", {
		date: extraction.date.value,
		envelope: extraction.security_movement_envelope.value,
		items: extraction.items.length,
		conveyingName: extraction.conveying_officer.name.value,
		onBehalfName: extraction.on_behalf_of_officer.name.value,
	});

	// Case number — derived from the first item's property reference.
	// The police reference number is the property reference up to the
	// '/' character (e.g. "050325 0840 10204/0065" → "050325 0840 10204").
	if (extraction.items.length > 0) {
		const firstRef = String(extraction.items[0].property_reference.value ?? "");
		if (firstRef.includes("/")) {
			const caseNumber = firstRef.substring(0, firstRef.indexOf("/"));
			formStore.updateField("case_number", caseNumber.trim());
			console.log("[OCR Prefill] Set case_number:", caseNumber.trim());
		}
	}

	// Received date
	if (extraction.date.value && typeof extraction.date.value === "string") {
		formStore.updateField("received", extraction.date.value);
		console.log("[OCR Prefill] Set received:", extraction.date.value);
	}

	// Security movement envelope
	if (
		extraction.security_movement_envelope.value &&
		typeof extraction.security_movement_envelope.value === "string"
	) {
		formStore.updateField(
			"security_movement_envelope",
			extraction.security_movement_envelope.value
		);
	}

	// Submitting officer (conveying officer on the form)
	selectTopOfficerCandidate(
		matches.conveying_officer.candidates,
		"submitting",
		formStore
	);

	// Requesting officer (on-behalf-of officer on the form)
	selectTopOfficerCandidate(
		matches.on_behalf_of_officer.candidates,
		"requesting",
		formStore
	);

	// Station
	if (matches.station.candidates.length > 0) {
		const top = matches.station.candidates[0];
		const station: PoliceStationTiny = {
			id: top.id,
			name: String(top.display_data.name ?? ""),
			phone: null,
			address: "",
			postcode: "",
		};
		formStore.setSelectedStation(station);
	}

	// Defendant
	if (matches.defendant.candidates.length > 0) {
		const top = matches.defendant.candidates[0];
		const defendant: DefendantTiny = {
			id: top.id,
			given_names: String(top.display_data.given_names ?? ""),
			last_name: String(top.display_data.last_name ?? ""),
			full_name: String(top.display_data.full_name ?? ""),
			cases_count: 0,
		};
		formStore.setSelectedDefendants([defendant]);
	}

	// Drug bags from items table
	for (const item of extraction.items) {
		formStore.addDrugBag();
		const idx = formStore.formData.bags.length - 1;
		formStore.updateDrugBag(idx, {
			content_type: item.mapped_content_type as never,
			seal_tag_numbers: String(item.seal_number.value ?? ""),
			new_seal_tag_numbers: String(item.new_seal_number.value ?? ""),
			property_reference: String(item.property_reference.value ?? ""),
		});
	}

	// Mark form as dirty to trigger auto-save
	formStore.markDirty();
};

/** Select the highest-scoring officer candidate and set it on the form. */
const selectTopOfficerCandidate = (
	candidates: OcrExtractionResponse["matches"]["conveying_officer"]["candidates"],
	type: "requesting" | "submitting",
	formStore: CaseFormStore
): void => {
	if (candidates.length === 0) return;

	const top = candidates[0];
	const officer: PoliceOfficerTiny = {
		id: top.id,
		badge_number: String(top.display_data.badge_number ?? ""),
		first_name: null,
		last_name: null,
		full_name: String(top.display_data.full_name ?? ""),
		rank: "unknown",
		rank_display: "",
		station: null,
		station_name: String(top.display_data.station_name ?? ""),
		email: "",
		is_sworn: false,
	};
	formStore.setSelectedOfficer(type, officer);
};
