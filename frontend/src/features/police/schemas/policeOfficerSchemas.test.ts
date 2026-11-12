import { describe, expect, it } from "vitest";
import {
	NO_RANK_FORM_VALUE,
	createOfficerSchema,
	officerRankOptions,
	rankFromFormValue,
	rankToFormValue,
} from "./policeOfficerSchemas";

describe("officer rank form values", () => {
	it("offers No rank first and no sworn or unsworn officer rank", () => {
		expect(officerRankOptions[0]).toEqual({
			value: NO_RANK_FORM_VALUE,
			label: "No rank",
		});
		const values = officerRankOptions.map((o) => o.value as string);
		expect(values).not.toContain("sworn_officer");
		expect(values).not.toContain("unsworn_officer");
		expect(values).not.toContain("");
	});

	it("maps a stored blank rank to the No rank option and back", () => {
		expect(rankToFormValue("")).toBe(NO_RANK_FORM_VALUE);
		expect(rankToFormValue(null)).toBe(NO_RANK_FORM_VALUE);
		expect(rankFromFormValue(NO_RANK_FORM_VALUE)).toBe("");
	});

	it("keeps a real rank unchanged both ways", () => {
		expect(rankToFormValue("sergeant")).toBe("sergeant");
		expect(rankFromFormValue("sergeant")).toBe("sergeant");
	});

	it("accepts No rank as a valid choice", () => {
		const result = createOfficerSchema.safeParse({
			last_name: "Lee",
			rank: NO_RANK_FORM_VALUE,
		});
		expect(result.success).toBe(true);
	});
});
