import { describe, it, expect } from "vitest";
import { describeRoles, withReplacement } from "./record-usage.utils";

describe("withReplacement", () => {
	it("adds the replacement to the delete address", () => {
		expect(withReplacement("/police/officers/4", 9)).toBe(
			"/police/officers/4?replacement=9"
		);
	});

	it("leaves the address alone when there is no replacement", () => {
		expect(withReplacement("/police/officers/4", null)).toBe(
			"/police/officers/4"
		);
	});
});

describe("describeRoles", () => {
	it("names one role", () => {
		expect(describeRoles(["conveying"])).toBe("Conveying officer");
	});

	it("joins two roles", () => {
		expect(describeRoles(["conveying", "requesting"])).toBe(
			"Conveying officer and requesting officer"
		);
	});
});
