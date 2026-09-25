import { describe, it, expect } from "vitest";
import {
	resizeEntries,
	isPlantContent,
	type BulkBagEntry,
} from "./bulkAddBags.utils";

const makeId = (i: number) => `id-${i}`;
const defaults = {
	content_type: "plant" as const,
	determination: "cannabis_sativa" as const,
};

/** A filled-in entry, so preservation is observable. */
const filled = (i: number, female = false): BulkBagEntry => ({
	id: `id-${i}`,
	seal_tag_numbers: `T${i}`,
	new_seal_tag_numbers: `N${i}`,
	content_type: "seed",
	determination: "not_cannabis",
	contains_female_plants: female,
});

describe("resizeEntries", () => {
	it("keeps existing entries untouched when growing", () => {
		const prev = [filled(0, true)];

		const next = resizeEntries(prev, 3, defaults, makeId);

		expect(next).toHaveLength(3);
		// The original entry, including its female flag and tags, is preserved.
		expect(next[0]).toEqual(prev[0]);
	});

	it("appends fresh entries with the given defaults when growing", () => {
		const next = resizeEntries([filled(0)], 2, defaults, makeId);

		expect(next[1]).toEqual({
			id: "id-1",
			seal_tag_numbers: "",
			new_seal_tag_numbers: "",
			content_type: "plant",
			determination: "cannabis_sativa",
			contains_female_plants: false,
		});
	});

	it("drops entries from the end when shrinking, keeping the earlier ones", () => {
		const prev = [filled(0, true), filled(1), filled(2)];

		const next = resizeEntries(prev, 2, defaults, makeId);

		expect(next).toHaveLength(2);
		expect(next[0]).toEqual(prev[0]);
		expect(next[1]).toEqual(prev[1]);
	});

	it("preserves a female flag on an entry that survives a shrink", () => {
		const prev = [filled(0, true), filled(1, false)];

		const next = resizeEntries(prev, 1, defaults, makeId);

		expect(next).toHaveLength(1);
		expect(next[0].contains_female_plants).toBe(true);
	});

	it("returns the same entries when the count is unchanged", () => {
		const prev = [filled(0, true), filled(1)];

		expect(resizeEntries(prev, 2, defaults, makeId)).toEqual(prev);
	});
});

describe("isPlantContent", () => {
	it("is true for plant content types", () => {
		expect(isPlantContent("plant")).toBe(true);
		expect(isPlantContent("plant_material")).toBe(true);
	});

	it("is false for non-plant content types", () => {
		expect(isPlantContent("seed")).toBe(false);
		expect(isPlantContent("unknown")).toBe(false);
	});
});
