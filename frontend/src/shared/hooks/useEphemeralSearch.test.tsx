import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockAllowed = vi.fn();
vi.mock("@/shared/hooks/data/useFeatureFlags", () => ({
	useSavedSearchesAllowed: () => mockAllowed(),
}));

import { useEphemeralSearch } from "./useEphemeralSearch";

describe("useEphemeralSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("clears the store on unmount when saved searches are off", () => {
		mockAllowed.mockReturnValue(false);
		const store = { clearSearchAndFilters: vi.fn() };

		const { unmount } = renderHook(() => useEphemeralSearch(store));
		expect(store.clearSearchAndFilters).not.toHaveBeenCalled();

		unmount();
		expect(store.clearSearchAndFilters).toHaveBeenCalledTimes(1);
	});

	it("does NOT clear the store on unmount when saved searches are on", () => {
		mockAllowed.mockReturnValue(true);
		const store = { clearSearchAndFilters: vi.fn() };

		const { unmount } = renderHook(() => useEphemeralSearch(store));
		unmount();
		expect(store.clearSearchAndFilters).not.toHaveBeenCalled();
	});
});
