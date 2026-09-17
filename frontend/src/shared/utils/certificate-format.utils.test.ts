import { describe, it, expect } from "vitest";
import {
	numberToWords,
	formatOfficerLegal,
	formatContentDescription,
	formatCertificateDate,
	joinWithAnd,
} from "./certificate-format.utils";

describe("certificate-format.utils", () => {
	describe("numberToWords", () => {
		it("returns an empty string for zero (matches backend)", () => {
			expect(numberToWords(0)).toBe("");
		});

		it("spells out values below twenty", () => {
			expect(numberToWords(1)).toBe("one");
			expect(numberToWords(13)).toBe("thirteen");
			expect(numberToWords(19)).toBe("nineteen");
		});

		it("hyphenates compound tens", () => {
			expect(numberToWords(20)).toBe("twenty");
			expect(numberToWords(21)).toBe("twenty-one");
			expect(numberToWords(99)).toBe("ninety-nine");
		});

		it("returns the numeric string for 100 and above", () => {
			expect(numberToWords(100)).toBe("100");
			expect(numberToWords(250)).toBe("250");
		});

		it("returns the numeric string for negatives", () => {
			expect(numberToWords(-5)).toBe("-5");
		});
	});

	describe("formatOfficerLegal", () => {
		it("returns [Pending] for null", () => {
			expect(formatOfficerLegal(null)).toBe("[Pending]");
		});

		it("formats rank, badge, surname, given names and organisation", () => {
			expect(
				formatOfficerLegal({
					rank_display: "Sergeant",
					badge_number: "1234",
					given_names: "Jane",
					last_name: "Smith",
					station_name: "Perth Station",
				})
			).toBe("Sergeant 1234 SMITH, Jane of Perth Station");
		});

		it("omits missing parts", () => {
			expect(
				formatOfficerLegal({ rank_display: "Constable", last_name: "Doe" })
			).toBe("Constable DOE");
		});

		it("returns [Pending] when every field is empty", () => {
			expect(formatOfficerLegal({})).toBe("[Pending]");
		});
	});

	describe("formatContentDescription", () => {
		it("returns a pending placeholder for no bags", () => {
			expect(formatContentDescription([])).toBe("quantity of [Pending]");
		});

		it("deduplicates content types", () => {
			expect(
				formatContentDescription([
					{ content_type_display: "Plant Material" },
					{ content_type_display: "Plant Material" },
					{ content_type_display: "Seed" },
				])
			).toBe("quantity of Plant Material and Seed");
		});
	});

	describe("formatCertificateDate", () => {
		it("returns [Pending] for falsy input", () => {
			expect(formatCertificateDate(null)).toBe("[Pending]");
			expect(formatCertificateDate(undefined)).toBe("[Pending]");
			expect(formatCertificateDate("")).toBe("[Pending]");
		});

		it("formats an ISO date as 'D Month YYYY'", () => {
			expect(formatCertificateDate("2026-06-11")).toBe("11 June 2026");
			expect(formatCertificateDate("2026-06-11T09:30:00Z")).toBe(
				"11 June 2026"
			);
		});
	});
});

/**
 * Certificates are read aloud in court, so lists must read as prose rather than
 * as comma-separated data. These mirror the backend join_with_and tests so the
 * two implementations stay in step.
 */
describe("joinWithAnd", () => {
	it("returns an empty string for no values", () => {
		expect(joinWithAnd([])).toBe("");
	});

	it("returns a single value alone", () => {
		expect(joinWithAnd(["T001"])).toBe("T001");
	});

	it("joins two values with and", () => {
		expect(joinWithAnd(["T001", "T002"])).toBe("T001 and T002");
	});

	it("separates three values with commas then and", () => {
		expect(joinWithAnd(["T001", "T002", "T003"])).toBe("T001, T002 and T003");
	});

	it("handles four values", () => {
		expect(joinWithAnd(["A", "B", "C", "D"])).toBe("A, B, C and D");
	});

	// No serial comma before "and", matching Australian usage.
	it("does not use a serial comma", () => {
		expect(joinWithAnd(["A", "B", "C"])).not.toContain(", and");
	});

	it("drops empty values", () => {
		expect(joinWithAnd(["A", "", "D"])).toBe("A and D");
	});

	it("drops null and undefined values", () => {
		expect(joinWithAnd(["A", null, undefined, "D"])).toBe("A and D");
	});

	it("drops whitespace-only values", () => {
		expect(joinWithAnd(["A", "   ", "D"])).toBe("A and D");
	});

	it("trims the values it keeps", () => {
		expect(joinWithAnd(["  A  ", " B "])).toBe("A and B");
	});

	it("returns an empty string when every value is empty", () => {
		expect(joinWithAnd(["", null, "  "])).toBe("");
	});
});

describe("formatContentDescription — conjunctions", () => {
	it("reports a single content type", () => {
		expect(
			formatContentDescription([{ content_type_display: "Plant Material" }])
		).toBe("quantity of Plant Material");
	});

	it("joins three distinct content types with commas then and", () => {
		expect(
			formatContentDescription([
				{ content_type_display: "Plant Material" },
				{ content_type_display: "Seed" },
				{ content_type_display: "Cutting" },
			])
		).toBe("quantity of Plant Material, Seed and Cutting");
	});

	it("reports a placeholder when content types are missing", () => {
		expect(formatContentDescription([{}, {}])).toBe("quantity of [Pending]");
	});
});
