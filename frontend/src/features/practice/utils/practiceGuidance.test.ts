import { describe, it, expect } from "vitest";
import { derivePracticeStep, getPracticeGuidance } from "./practiceGuidance";

describe("derivePracticeStep", () => {
	it("is step 1 before a case is saved", () => {
		expect(derivePracticeStep({ caseExists: false })).toBe(1);
	});

	it("is step 2 while recording samples (assessment)", () => {
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "assessment" })
		).toBe(2);
	});

	it("is step 3 once certificates are generated but not all marked ready", () => {
		expect(
			derivePracticeStep({
				caseExists: true,
				derivedStatus: "unsigned_generation",
				forms: [
					{ phase: "unsigned_generation", marked_ready: true },
					{ phase: "unsigned_generation", marked_ready: false },
				],
			})
		).toBe(3);
	});

	it("is step 4 once every form is generated and marked ready", () => {
		expect(
			derivePracticeStep({
				caseExists: true,
				derivedStatus: "unsigned_generation",
				forms: [
					{ phase: "unsigned_generation", marked_ready: true },
					{ phase: "unsigned_generation", marked_ready: true },
				],
			})
		).toBe(4);
	});

	it("is step 5 once finalised and awaiting batching", () => {
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "batching" })
		).toBe(5);
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "in_batch" })
		).toBe(5);
	});

	it("is step 6 once complete", () => {
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "complete" })
		).toBe(6);
	});
});

describe("getPracticeGuidance", () => {
	it("marks earlier steps done and the current step current", () => {
		const g = getPracticeGuidance("/cases/5", 3);
		expect(g.currentStep).toBe(3);
		expect(g.steps.find((s) => s.number === 1)?.done).toBe(true);
		expect(g.steps.find((s) => s.number === 3)?.current).toBe(true);
		expect(g.steps.find((s) => s.number === 4)?.done).toBe(false);
	});

	it("keeps the user in the batching half on the batches page", () => {
		const g = getPracticeGuidance("/batches", 1);
		expect(g.currentStep).toBe(5);
	});

	it("does not pull a later step back on the batches page", () => {
		const g = getPracticeGuidance("/batches", 6);
		expect(g.currentStep).toBe(6);
	});
});
