import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useLinkedFilters } from "./useLinkedFilters";

const wrapperAt =
	(entry: string) =>
	({ children }: { children: ReactNode }) => (
		<MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
	);

const useLinkedAndLocation = (apply: (ids: object) => void) => {
	useLinkedFilters(["officer", "station"] as const, apply);
	return useLocation();
};

describe("useLinkedFilters", () => {
	it("applies the ids from the address, then removes them", () => {
		const apply = vi.fn();
		const { result } = renderHook(() => useLinkedAndLocation(apply), {
			wrapper: wrapperAt("/cases?officer=12&station=3&page=2"),
		});

		expect(apply).toHaveBeenCalledOnce();
		expect(apply).toHaveBeenCalledWith({ officer: 12, station: 3 });
		// Other parameters are kept.
		expect(result.current.search).toBe("?page=2");
	});

	it("does nothing when the address has none of the keys", () => {
		const apply = vi.fn();
		const { result } = renderHook(() => useLinkedAndLocation(apply), {
			wrapper: wrapperAt("/cases?page=2"),
		});

		expect(apply).not.toHaveBeenCalled();
		expect(result.current.search).toBe("?page=2");
	});

	it("ignores ids that are not positive whole numbers but still cleans up", () => {
		const apply = vi.fn();
		const { result } = renderHook(() => useLinkedAndLocation(apply), {
			wrapper: wrapperAt("/cases?officer=abc&station=-1"),
		});

		expect(apply).not.toHaveBeenCalled();
		expect(result.current.search).toBe("");
	});
});
