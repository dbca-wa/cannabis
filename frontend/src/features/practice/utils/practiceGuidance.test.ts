import { describe, it, expect } from "vitest";
import { derivePracticeStep, getPracticeGuidance } from "./practiceGuidance";

describe("derivePracticeStep", () => {
	it("is step 1 before a case is saved", () => {
		expect(derivePracticeStep({ caseExists: false })).toBe(1);
	});

	it("is step 2 while recording samples (assessment, not all recorded)", () => {
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "assessment" })
		).toBe(2);
	});

	it("advances to step 3 once all samples are recorded, before any cert", () => {
		expect(
			derivePracticeStep({
				caseExists: true,
				derivedStatus: "assessment",
				formsRecorded: true,
			})
		).toBe(3);
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

	it("is step 5 for all finalised states (batching, in_batch, complete)", () => {
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "batching" })
		).toBe(5);
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "in_batch" })
		).toBe(5);
		expect(
			derivePracticeStep({ caseExists: true, derivedStatus: "complete" })
		).toBe(5);
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

	it("moves the user to the final step on the batches page", () => {
		const g = getPracticeGuidance("/batches", 1);
		expect(g.currentStep).toBe(5);
	});

	it("has five steps and a merged batch-and-complete final step", () => {
		const g = getPracticeGuidance("/batches", 5);
		expect(g.steps.length).toBe(5);
		expect(g.heading).toMatch(/Batch and complete/i);
	});

	it("tells the user to click New Case when not yet on the create form", () => {
		const g = getPracticeGuidance("/cases", 1);
		expect(g.instructions[0]).toMatch(/click 'New Case'/);
	});

	it("drops the New Case nudge once on the create form", () => {
		const g = getPracticeGuidance("/cases/add", 1);
		expect(g.instructions.some((l) => l.includes("click 'New Case'"))).toBe(
			false
		);
		// The received-date default note is present.
		expect(g.instructions.some((l) => /defaults to the date/.test(l))).toBe(
			true
		);
	});
});

describe("getPracticeGuidance — reference mode (practice = false)", () => {
	it("drops the practice-only phrasing from the instructions", () => {
		for (let step = 1; step <= 5; step++) {
			const g = getPracticeGuidance("/cases", step, false);
			const all = `${g.heading} ${g.instructions.join(" ")}`;
			expect(all).not.toMatch(/brief below/i);
			expect(all).not.toMatch(/fake data/i);
			expect(all).not.toMatch(/already selected for you/i);
		}
	});

	it("tells the user to choose the approved botanist, not accept a default", () => {
		const g = getPracticeGuidance("/cases", 1, false);
		expect(
			g.instructions.some((l) => /choose the approved botanist/i.test(l))
		).toBe(true);
	});

	it("does not force the final step on the batches page (free browsing)", () => {
		const g = getPracticeGuidance("/batches", 2, false);
		expect(g.currentStep).toBe(2);
		expect(g.heading).toMatch(/Record the samples/i);
	});

	it("keeps the New Case nudge even on the create form (free browsing)", () => {
		const g = getPracticeGuidance("/cases/add", 1, false);
		expect(g.instructions.some((l) => l.includes("click 'New Case'"))).toBe(
			true
		);
	});
});
