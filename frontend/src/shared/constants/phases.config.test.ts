import { describe, it, expect } from "vitest";
import {
	PHASE_STEPS,
	PHASE_KEYS,
	PHASE_DISPLAY_NAMES,
	PHASE_BADGE_COLOURS,
	PHASE_HEX_COLOURS,
	getPhaseIndex,
	getPhaseProgress,
	getNextPhase,
	getCompletedPhases,
	isValidPhase,
} from "./phases.config";
import type { CasePhase } from "@/features/cases/types/cases.types";

const ORDERED_PHASES: CasePhase[] = [
	"assessment",
	"unsigned_generation",
	"batching",
	"in_batch",
	"complete",
];

describe("phases.config", () => {
	describe("PHASE_STEPS / PHASE_KEYS", () => {
		it("defines the five workflow phases in order", () => {
			expect(PHASE_KEYS).toEqual(ORDERED_PHASES);
			expect(PHASE_STEPS).toHaveLength(5);
			expect(PHASE_STEPS.map((s) => s.key)).toEqual(ORDERED_PHASES);
		});

		it("gives every step a label, short label, description and colours", () => {
			for (const step of PHASE_STEPS) {
				expect(step.label).toBeTruthy();
				expect(step.shortLabel).toBeTruthy();
				expect(step.description).toBeTruthy();
				expect(step.badgeColour).toBeTruthy();
				expect(step.hexColour).toMatch(/^#[0-9a-f]{6}$/i);
				expect(step.icon).toBeTypeOf("object");
			}
		});
	});

	describe("derived maps", () => {
		it("maps each phase key to its display label", () => {
			expect(PHASE_DISPLAY_NAMES.assessment).toBe("Assessment");
			expect(PHASE_DISPLAY_NAMES.unsigned_generation).toBe(
				"Unsigned Certificate"
			);
			expect(PHASE_DISPLAY_NAMES.complete).toBe("Complete");
			expect(Object.keys(PHASE_DISPLAY_NAMES).sort()).toEqual(
				[...ORDERED_PHASES].sort()
			);
		});

		it("exposes badge and hex colour maps for every phase", () => {
			for (const key of ORDERED_PHASES) {
				expect(PHASE_BADGE_COLOURS[key]).toBeTruthy();
				expect(PHASE_HEX_COLOURS[key]).toMatch(/^#[0-9a-f]{6}$/i);
			}
		});
	});

	describe("getPhaseIndex", () => {
		it("returns the 0-based index for known phases", () => {
			expect(getPhaseIndex("assessment")).toBe(0);
			expect(getPhaseIndex("batching")).toBe(2);
			expect(getPhaseIndex("complete")).toBe(4);
		});

		it("returns -1 for an unknown phase", () => {
			expect(getPhaseIndex("nonsense" as CasePhase)).toBe(-1);
		});
	});

	describe("getPhaseProgress", () => {
		it("returns evenly spaced progress across the workflow", () => {
			expect(getPhaseProgress("assessment")).toBe(0);
			expect(getPhaseProgress("unsigned_generation")).toBe(25);
			expect(getPhaseProgress("batching")).toBe(50);
			expect(getPhaseProgress("in_batch")).toBe(75);
			expect(getPhaseProgress("complete")).toBe(100);
		});

		it("returns 0 for an unknown phase", () => {
			expect(getPhaseProgress("nonsense" as CasePhase)).toBe(0);
		});
	});

	describe("getNextPhase", () => {
		it("returns the following phase for each non-terminal phase", () => {
			expect(getNextPhase("assessment")).toBe("unsigned_generation");
			expect(getNextPhase("unsigned_generation")).toBe("batching");
			expect(getNextPhase("batching")).toBe("in_batch");
			expect(getNextPhase("in_batch")).toBe("complete");
		});

		it("returns null at the terminal phase", () => {
			expect(getNextPhase("complete")).toBeNull();
		});

		it("returns null for an unknown phase", () => {
			expect(getNextPhase("nonsense" as CasePhase)).toBeNull();
		});
	});

	describe("getCompletedPhases", () => {
		it("returns no completed phases at the start", () => {
			expect(getCompletedPhases("assessment")).toEqual([]);
		});

		it("returns all earlier phases for a mid-workflow phase", () => {
			expect(getCompletedPhases("batching")).toEqual([
				"assessment",
				"unsigned_generation",
			]);
		});

		it("returns every prior phase at the terminal phase", () => {
			expect(getCompletedPhases("complete")).toEqual([
				"assessment",
				"unsigned_generation",
				"batching",
				"in_batch",
			]);
		});

		it("returns no completed phases for an unknown phase", () => {
			expect(getCompletedPhases("nonsense" as CasePhase)).toEqual([]);
		});
	});

	describe("isValidPhase", () => {
		it("accepts every canonical phase key", () => {
			for (const key of ORDERED_PHASES) {
				expect(isValidPhase(key)).toBe(true);
			}
		});

		it("rejects unknown strings", () => {
			expect(isValidPhase("data_entry")).toBe(false);
			expect(isValidPhase("")).toBe(false);
			expect(isValidPhase("ASSESSMENT")).toBe(false);
		});
	});
});
