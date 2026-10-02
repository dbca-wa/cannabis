import { describe, it, expect } from "vitest";
import { generateCertificateHTML } from "./certificateTemplate";
import type { CertificateData } from "../stores/caseForm.store";

/**
 * The live preview must match the generated PDF, which names the conveying
 * (submitting) officer as an "Unsworn Officer" in both section (a) and section
 * (b), and the requesting officer as a "Sworn Officer" in section (a).
 */
const data = {
	case_number: "IR 123",
	received_date: "2026-03-20",
	submitting_officer: {
		rank_display: "Sergeant",
		badge_number: "PD100",
		given_names: "Jo",
		last_name: "Bloggs",
	},
	requesting_officer: {
		rank_display: "Senior Constable",
		badge_number: "PD200",
		given_names: "Sam",
		last_name: "Reed",
	},
	defendants: [{ last_name: "Doe", given_names: "John" }],
	bags: [
		{
			seal_tag_numbers: "T1",
			new_seal_tag_numbers: "N1",
			content_type: "plant",
			determination: "cannabis_sativa",
			contains_female_plants: false,
			botanist_notes: null,
		},
	],
	total_bags: 1,
	approved_botanist: { full_name: "Dr Bot" },
} as unknown as CertificateData;

describe("generateCertificateHTML — officer role labels", () => {
	const html = generateCertificateHTML(data);

	it("names the conveying officer as Unsworn Officer", () => {
		expect(html).toContain("Unsworn Officer PD100 BLOGGS, Jo");
	});

	it("names the requesting officer as Sworn Officer in section (a)", () => {
		expect(html).toContain("Sworn Officer PD200 REED, Sam");
	});

	it("does not label the conveying officer by rank", () => {
		expect(html).not.toContain("Sergeant PD100");
	});

	it("uses Unsworn Officer in the section (b) handover sentence", () => {
		// Section (b) describes who the bags were handed over to.
		const handoverIndex = html.indexOf("handed over to");
		expect(handoverIndex).toBeGreaterThan(-1);
		const afterHandover = html.slice(handoverIndex, handoverIndex + 120);
		expect(afterHandover).toContain("Unsworn Officer");
	});
});
