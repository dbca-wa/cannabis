import { describe, it, expect } from "vitest";
import {
	CASE_SECTIONS,
	deriveCaseSectionFlags,
	deriveCaseSectionStates,
	describeSectionState,
	firstIncompleteSection,
} from "./caseSections";
import type { Priority3Form } from "@/shared/types/backend-api.types";

/** Case data holding everything the details section needs. */
const completeCaseData = () => ({
	case_number: "IR 123456789",
	received: "2026-03-20T09:00:00Z",
	submitting_officer_id: 1,
	approved_botanist_id: 2,
});

/** A form with the given bags, typed loosely enough for the derivation. */
const form = (
	id: number,
	bags: Array<{ determination: string | null }>,
	certificate: unknown = null
) =>
	({
		id,
		bags: bags.map((bag, index) => ({
			id: id * 100 + index,
			assessment: bag.determination
				? { determination: bag.determination }
				: null,
		})),
		certificate,
	}) as unknown as Priority3Form;

describe("CASE_SECTIONS", () => {
	it("lists the three sections in the order they are shown", () => {
		expect(CASE_SECTIONS.map((s) => s.id)).toEqual([
			"details",
			"assessment",
			"certificates",
		]);
	});
});

describe("deriveCaseSectionFlags — details", () => {
	it("is complete when reference, date, officer and botanist are all set", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), []);
		expect(flags.details).toBe(true);
	});

	it("is incomplete without a case number", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), case_number: "" },
			[]
		);
		expect(flags.details).toBe(false);
	});

	it("treats a whitespace-only case number as missing", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), case_number: "   " },
			[]
		);
		expect(flags.details).toBe(false);
	});

	it("is incomplete without a received date", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), received: "" },
			[]
		);
		expect(flags.details).toBe(false);
	});

	it("is incomplete without a submitting officer", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), submitting_officer_id: null },
			[]
		);
		expect(flags.details).toBe(false);
	});

	it("is incomplete without an approved botanist", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), approved_botanist_id: null },
			[]
		);
		expect(flags.details).toBe(false);
	});

	// The requesting officer is optional, so its absence must not block anything.
	it("stays complete with no requesting officer", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), requesting_officer_id: null },
			[]
		);
		expect(flags.details).toBe(true);
	});

	it("is incomplete with no case data at all", () => {
		expect(deriveCaseSectionFlags(null, []).details).toBe(false);
	});
});

describe("deriveCaseSectionFlags — assessment", () => {
	it("is incomplete when no forms exist", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), []);
		expect(flags.hasForms).toBe(false);
		expect(flags.assessment).toBe(false);
	});

	it("is incomplete when a form has no bags", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [form(1, [])]);
		expect(flags.allFormsHaveBags).toBe(false);
		expect(flags.assessment).toBe(false);
	});

	it("is incomplete when a bag has no assessment", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: null }]),
		]);
		expect(flags.allBagsAssessed).toBe(false);
		expect(flags.assessment).toBe(false);
	});

	it("is incomplete when a bag is still pending", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "pending" }]),
		]);
		expect(flags.assessment).toBe(false);
	});

	it("is complete when every bag on every form is assessed", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }]),
			form(2, [{ determination: "not_cannabis" }]),
		]);
		expect(flags.assessment).toBe(true);
	});

	// Case-level, not form-level: one finished form must not report the section done.
	it("is incomplete when a second form lags behind", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }]),
			form(2, [{ determination: null }]),
		]);
		expect(flags.assessment).toBe(false);
	});
});

describe("deriveCaseSectionFlags — certificates", () => {
	it("is incomplete when no forms exist", () => {
		expect(deriveCaseSectionFlags(completeCaseData(), []).certificates).toBe(
			false
		);
	});

	it("is incomplete when a form has no certificate", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }], { id: 9 }),
			form(2, [{ determination: "cannabis_sativa" }], null),
		]);
		expect(flags.certificates).toBe(false);
	});

	it("is complete when every form has a certificate", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }], { id: 9 }),
			form(2, [{ determination: "cannabis_sativa" }], { id: 10 }),
		]);
		expect(flags.certificates).toBe(true);
	});
});

describe("firstIncompleteSection", () => {
	it("returns null when everything is complete", () => {
		expect(
			firstIncompleteSection({
				details: true,
				assessment: true,
				certificates: true,
			})
		).toBeNull();
	});

	it("returns details when details is outstanding", () => {
		expect(
			firstIncompleteSection({
				details: false,
				assessment: false,
				certificates: false,
			})
		).toBe("details");
	});

	it("reports sections in page order, not the first false found elsewhere", () => {
		expect(
			firstIncompleteSection({
				details: true,
				assessment: false,
				certificates: false,
			})
		).toBe("assessment");
	});

	it("returns certificates when only certificates is outstanding", () => {
		expect(
			firstIncompleteSection({
				details: true,
				assessment: true,
				certificates: false,
			})
		).toBe("certificates");
	});
});

describe("deriveCaseSectionStates", () => {
	it("marks every section complete on a finished case", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }], { id: 5 }),
		]);

		expect(deriveCaseSectionStates(flags)).toEqual({
			details: "complete",
			assessment: "complete",
			certificates: "complete",
		});
	});

	it("asks for attention on details as soon as a required field is missing", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), case_number: "" },
			[form(1, [{ determination: "cannabis_sativa" }], { id: 5 })]
		);

		expect(deriveCaseSectionStates(flags).details).toBe("attention");
	});

	it("leaves dependent sections not started when the case has no forms", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), []);
		const states = deriveCaseSectionStates(flags);

		expect(states.assessment).toBe("notStarted");
		expect(states.certificates).toBe("notStarted");
	});

	it("asks for attention on the assessment once a form exists without bags", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [form(1, [])]);

		expect(deriveCaseSectionStates(flags).assessment).toBe("attention");
	});

	it("asks for attention on a bag that has not been determined", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "pending" }]),
		]);

		expect(deriveCaseSectionStates(flags).assessment).toBe("attention");
	});

	it("holds certificates back from attention until the assessment is done", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [form(1, [])]);

		expect(deriveCaseSectionStates(flags).certificates).toBe("notStarted");
	});

	it("asks for attention on certificates once the assessment is done", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }]),
		]);

		expect(deriveCaseSectionStates(flags).certificates).toBe("attention");
	});
});

describe("describeSectionState", () => {
	it("says nothing about a section that is complete", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }], { id: 5 }),
		]);

		expect(describeSectionState("details", flags)).toBeNull();
		expect(describeSectionState("assessment", flags)).toBeNull();
		expect(describeSectionState("certificates", flags)).toBeNull();
	});

	it("names missing case details", () => {
		const flags = deriveCaseSectionFlags(
			{ ...completeCaseData(), received: "" },
			[form(1, [{ determination: "cannabis_sativa" }], { id: 5 })]
		);

		expect(describeSectionState("details", flags)).toMatch(/case details/i);
	});

	it("asks for a form before anything else", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), []);

		expect(describeSectionState("assessment", flags)).toMatch(
			/add a priority 3 form/i
		);
		expect(describeSectionState("certificates", flags)).toMatch(
			/add a priority 3 form/i
		);
	});

	it("asks for a bag when a form is empty", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [form(1, [])]);

		expect(describeSectionState("assessment", flags)).toMatch(
			/at least one bag/i
		);
	});

	it("asks for a determination when a bag is still pending", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "pending" }]),
		]);

		expect(describeSectionState("assessment", flags)).toMatch(
			/needs a determination/i
		);
	});

	it("points at the assessment before asking for certificates", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [form(1, [])]);

		expect(describeSectionState("certificates", flags)).toMatch(
			/finish the assessment/i
		);
	});

	it("asks for a certificate once the assessment is done", () => {
		const flags = deriveCaseSectionFlags(completeCaseData(), [
			form(1, [{ determination: "cannabis_sativa" }]),
		]);

		expect(describeSectionState("certificates", flags)).toMatch(
			/generated certificate/i
		);
	});
});
