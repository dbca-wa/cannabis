import { describe, it, expect } from "vitest";
import {
	createDefendantSchema,
	isPlaceholderName,
	PLACEHOLDER_DEFENDANT_MESSAGE,
} from "./defendantSchemas";

const messages = (input: Record<string, string>) => {
	const result = createDefendantSchema.safeParse(input);
	return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("isPlaceholderName", () => {
	it.each(["Unknown", "unknown", "  UNKNOWN  "])("flags %j", (value) => {
		expect(isPlaceholderName(value)).toBe(true);
	});

	it.each(["", undefined, "Unknownson", "Jane"])("allows %j", (value) => {
		expect(isPlaceholderName(value)).toBe(false);
	});
});

describe("createDefendantSchema", () => {
	it("accepts a real name", () => {
		expect(messages({ given_names: "Jane", last_name: "Doe" })).toEqual([]);
	});

	it("accepts a last name with no given names", () => {
		expect(messages({ given_names: "", last_name: "Doe" })).toEqual([]);
	});

	it("rejects Unknown as the last name", () => {
		expect(messages({ given_names: "Jane", last_name: "unknown" })).toContain(
			PLACEHOLDER_DEFENDANT_MESSAGE
		);
	});

	it("rejects Unknown as the given names", () => {
		expect(messages({ given_names: " Unknown ", last_name: "Doe" })).toContain(
			PLACEHOLDER_DEFENDANT_MESSAGE
		);
	});
});
