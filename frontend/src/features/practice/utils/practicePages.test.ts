import { describe, it, expect } from "vitest";
import { isSharedDataPage } from "./practicePages";

describe("isSharedDataPage", () => {
	it.each(["/settings", "/staff", "/staff/12", "/invites", "/testing"])(
		"treats %s as real, shared data",
		(path) => {
			expect(isSharedDataPage(path)).toBe(true);
		}
	);

	it.each(["/", "/cases", "/cases/5", "/batches", "/officers", "/guide"])(
		"treats %s as covered by practice mode",
		(path) => {
			expect(isSharedDataPage(path)).toBe(false);
		}
	);

	it("does not match a page that only starts with the same letters", () => {
		expect(isSharedDataPage("/settingsx")).toBe(false);
	});
});
