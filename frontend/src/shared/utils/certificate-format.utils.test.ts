import { describe, it, expect } from "vitest";
import {
	numberToWords,
	formatOfficerLegal,
	formatContentDescription,
	formatCertificateDate,
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
			).toBe("quantity of Plant Material, Seed");
		});
	});

	describe("formatCertificateDate", () => {
		it("returns [Pending] for falsy input", () => {
			expect(formatCertificateDate(null)).toBe("[Pending]");
			expect(formatCertificateDate(undefined)).toBe("[Pending]");
			expect(formatCertificateDate("")).toBe("[Pending]");
		});

		it("formats an ISO date as 'D Month YYYY' when Temporal is available", () => {
			if (typeof Temporal === "undefined") return;
			expect(formatCertificateDate("2026-06-11")).toBe("11 June 2026");
			expect(formatCertificateDate("2026-06-11T09:30:00Z")).toBe(
				"11 June 2026"
			);
		});
	});
});
