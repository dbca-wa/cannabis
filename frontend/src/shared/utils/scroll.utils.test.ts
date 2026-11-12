import { describe, expect, it } from "vitest";
import { keepScrollState, shouldKeepScroll } from "./scroll.utils";

describe("shouldKeepScroll", () => {
	const state = keepScrollState("/cases/12");

	it.each(["/cases/12", "/cases/12/forms/40"])(
		"keeps the position when coming from %s",
		(previous) => {
			expect(shouldKeepScroll(state, previous)).toBe(true);
		}
	);

	it.each(["/cases", "/cases/120/forms/1", "/dashboard"])(
		"resets when coming from another page (%s)",
		(previous) => {
			expect(shouldKeepScroll(state, previous)).toBe(false);
		}
	);

	it("resets on the first page shown", () => {
		expect(shouldKeepScroll(state, null)).toBe(false);
	});

	it.each([null, undefined, "x", {}, { keepScrollWithin: 12 }])(
		"resets for the state %j",
		(other) => {
			expect(shouldKeepScroll(other, "/cases/12")).toBe(false);
		}
	);
});
