import { describe, it, expect, vi, afterEach } from "vitest";
import {
	getPlatformModifierKey,
	hasModifierKey,
	handleNavigableClick,
} from "./navigation.utils";

describe("navigation.utils", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getPlatformModifierKey", () => {
		it("returns a valid modifier key for the current platform", () => {
			expect(["ctrlKey", "metaKey"]).toContain(getPlatformModifierKey());
		});
	});

	describe("hasModifierKey", () => {
		it("matches the platform's modifier key", () => {
			const key = getPlatformModifierKey();
			const other = key === "ctrlKey" ? "metaKey" : "ctrlKey";

			expect(hasModifierKey({ [key]: true } as unknown as MouseEvent)).toBe(
				true
			);
			expect(hasModifierKey({ [other]: true } as unknown as MouseEvent)).toBe(
				false
			);
		});
	});

	describe("handleNavigableClick", () => {
		it("opens a new tab when a modifier key is held", () => {
			const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
			const navigate = vi.fn();

			handleNavigableClick(
				{ ctrlKey: true, metaKey: false } as React.MouseEvent,
				"/cases/1",
				navigate
			);

			expect(openSpy).toHaveBeenCalledWith("/cases/1", "_blank");
			expect(navigate).not.toHaveBeenCalled();
		});

		it("navigates in-app on a normal click", () => {
			const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
			const navigate = vi.fn();

			handleNavigableClick(
				{ ctrlKey: false, metaKey: false } as React.MouseEvent,
				"/cases/1",
				navigate
			);

			expect(navigate).toHaveBeenCalledWith("/cases/1");
			expect(openSpy).not.toHaveBeenCalled();
		});
	});
});
