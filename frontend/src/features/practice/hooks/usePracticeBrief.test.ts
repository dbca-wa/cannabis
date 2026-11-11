import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { PRACTICE_BRIEFS } from "../data/practiceBriefs";
import { usePracticeBrief } from "./usePracticeBrief";

describe("usePracticeBrief", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("returns nothing while practice mode is off", () => {
		const { result } = renderHook(() => usePracticeBrief(false));
		expect(result.current.data).toBeNull();
	});

	it("shows the session's brief to a caller that mounted before practice mode loaded", () => {
		sessionStorage.setItem("practice-brief-index", "1");
		const { result, rerender } = renderHook(
			({ on }: { on: boolean }) => usePracticeBrief(on),
			{ initialProps: { on: false } }
		);
		rerender({ on: true });
		expect(result.current.index).toBe(1);
		expect(result.current.data).toBe(PRACTICE_BRIEFS[1]);
	});

	it("keeps every caller on the same brief when one pages to another example", () => {
		sessionStorage.setItem("practice-brief-index", "0");
		const guide = renderHook(() => usePracticeBrief(true));
		const form = renderHook(() => usePracticeBrief(true));

		act(() => guide.result.current.next());

		expect(guide.result.current.index).toBe(1);
		expect(form.result.current.index).toBe(1);
		expect(form.result.current.data).toBe(PRACTICE_BRIEFS[1]);

		act(() => form.result.current.previous());

		expect(guide.result.current.index).toBe(0);
	});

	it("wraps around at either end", () => {
		sessionStorage.setItem("practice-brief-index", "0");
		const { result } = renderHook(() => usePracticeBrief(true));
		act(() => result.current.previous());
		expect(result.current.index).toBe(PRACTICE_BRIEFS.length - 1);
		act(() => result.current.next());
		expect(result.current.index).toBe(0);
	});
});
