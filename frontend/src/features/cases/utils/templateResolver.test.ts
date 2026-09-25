import { describe, it, expect } from "vitest";
import { buildTemplateContext, resolveTemplate } from "./templateResolver";
import type { DrugBag } from "../types/drugBags.types";

/** Minimal bag with just the fields the resolver reads. */
const bag = (seal: string, female: boolean, content = "Plant"): DrugBag =>
	({
		id: Math.floor(Math.random() * 100000),
		seal_tag_numbers: seal,
		new_seal_tag_numbers: null,
		content_type: "plant",
		content_type_display: content,
		contains_female_plants: female,
		assessment: null,
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
