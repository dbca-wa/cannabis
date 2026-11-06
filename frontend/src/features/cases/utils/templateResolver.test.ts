import { describe, it, expect } from "vitest";
import { buildTemplateContext, resolveTemplate } from "./templateResolver";
import { joinWithAnd } from "@/shared/utils/certificate-format.utils";
import { PRINTABLE_DETERMINATIONS } from "../constants/determinations";
import type { DrugBag } from "../types/drugBags.types";

/** Minimal bag with just the fields the resolver reads. */
const bag = (
	seal: string,
	female: boolean,
	determination: string | null = "cannabis_sativa"
): DrugBag =>
	({
		id: Math.floor(Math.random() * 100000),
		seal_tag_numbers: seal,
		new_seal_tag_numbers: null,
		content_type: "plant",
		content_type_display: "Plant",
		contains_female_plants: female,
		assessment: determination ? { determination } : null,
	}) as unknown as DrugBag;

const caseData = { case_number: "IR 1", security_movement_envelope: "WW001" };

describe("buildTemplateContext — female plant variables", () => {
	it("labels a single female bag 'Bag'", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", true),
			bag("B", false),
		]);

		expect(ctx.female_bag_label).toBe("Bag");
		expect(ctx.female_plant_sentence).toBe("Bag A contained female plants.");
	});

	it("labels multiple female bags 'Bags' and joins tags with and", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", true),
			bag("B", true),
			bag("C", false),
		]);

		expect(ctx.female_bag_label).toBe("Bags");
		expect(ctx.female_plant_sentence).toBe(
			"Bags A and B contained female plants."
		);
	});

	it("uses the all-bags wording when every bag is female", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", true),
			bag("B", true),
		]);

		expect(ctx.female_plant_sentence).toBe("All bags contained female plants.");
	});

	it("leaves the female variables empty when no bag is female", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", false),
			bag("B", false),
		]);

		expect(ctx.female_bag_label).toBe("");
		expect(ctx.female_plant_sentence).toBe("");
	});

	it("ignores a female flag on a bag that is not cannabis", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", true),
			bag("B", true, "inconclusive"),
		]);

		expect(ctx.female_plant_sentence).toBe("Bag A contained female plants.");
		expect(ctx.non_female_plant_tags).toBe("");
	});

	it("ignores a female flag on an unassessed bag", () => {
		const ctx = buildTemplateContext(caseData, [bag("A", true, null)]);

		expect(ctx.female_plant_sentence).toBe("");
	});

	it("resolves the SME + female template end to end", () => {
		const ctx = buildTemplateContext(caseData, [
			bag("A", true),
			bag("B", false),
		]);
		const template =
			"Subsamples placed into Security Movement Envelope " +
			"{{security_movement_envelope}}. {{female_plant_sentence}}";

		expect(resolveTemplate(template, ctx)).toBe(
			"Subsamples placed into Security Movement Envelope WW001. " +
				"Bag A contained female plants."
		);
	});
});

/** Every (result, female flag) state for one plant bag: 4 × 2 = 8. */
const BAG_STATES = PRINTABLE_DETERMINATIONS.flatMap((determination) =>
	[true, false].map((female) => ({ determination, female }))
);

const sequences = (length: number): (typeof BAG_STATES)[] =>
	length === 0
		? [[]]
		: sequences(length - 1).flatMap((rest) =>
				BAG_STATES.map((state) => [...rest, state])
			);

describe("female plant variables for every combination", () => {
	const all = [1, 2, 3, 4, 5].flatMap((n) => sequences(n));

	it("covers 37,448 sequences", () => {
		expect(all).toHaveLength(8 + 64 + 512 + 4096 + 32768);
	});

	it("counts only cannabis bags in every sequence", () => {
		for (const states of all) {
			const bags = states.map((s, i) =>
				bag(`T${i + 1}`, s.female, s.determination)
			);
			const ctx = buildTemplateContext(caseData, bags);

			const cannabis = states
				.map((s, i) => ({ ...s, tag: `T${i + 1}` }))
				.filter((s) => s.determination === "cannabis_sativa");
			const female = cannabis.filter((s) => s.female).map((s) => s.tag);
			const nonFemale = cannabis.filter((s) => !s.female).map((s) => s.tag);

			let sentence = "";
			if (female.length === states.length) {
				sentence = "All bags contained female plants.";
			} else if (female.length > 0) {
				sentence = `${female.length === 1 ? "Bag" : "Bags"} ${joinWithAnd(female)} contained female plants.`;
			}

			expect(ctx.female_plant_tags).toBe(joinWithAnd(female));
			expect(ctx.non_female_plant_tags).toBe(joinWithAnd(nonFemale));
			expect(ctx.female_plant_count).toBe(
				female.length ? String(female.length) : ""
			);
			expect(ctx.non_female_plant_count).toBe(
				nonFemale.length ? String(nonFemale.length) : ""
			);
			expect(ctx.female_plant_sentence).toBe(sentence);
		}
	});
});
