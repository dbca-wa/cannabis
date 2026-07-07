import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { ReactNode } from "react";
import { useCaseNumberAvailability } from "./useCaseNumberAvailability";

// Mock the debounce hook to return the value immediately (no delay)
vi.mock("@/shared/hooks", () => ({
	useDebounce: (value: string) => value,
}));

// Mock the service
vi.mock("../services/cases.service", () => ({
	checkCaseNumberExists: vi.fn(),
}));

import { checkCaseNumberExists } from "../services/cases.service";

/** Create a fresh QueryClient wrapper for each test. */
const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
		},
	});
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useCaseNumberAvailability", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns alreadyExists: true with the matched case when the number exists", async () => {
		const matchedCase = { id: 5, case_number: "POL-2024-001" };
		vi.mocked(checkCaseNumberExists).mockResolvedValue({
			exists: true,
			case: matchedCase,
		});

		const { result } = renderHook(
			() => useCaseNumberAvailability("POL-2024-001"),
			{ wrapper: createWrapper() }
		);

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false);
		});

		expect(result.current.alreadyExists).toBe(true);
		expect(result.current.matchedCase).toEqual(matchedCase);
	});

	it("returns alreadyExists: false with null matchedCase when the number is available", async () => {
		vi.mocked(checkCaseNumberExists).mockResolvedValue({
			exists: false,
			case: null,
		});

		const { result } = renderHook(
			() => useCaseNumberAvailability("NEW-REF-999"),
			{ wrapper: createWrapper() }
		);

		await waitFor(() => {
			expect(result.current.isChecking).toBe(false);
		});

		expect(result.current.alreadyExists).toBe(false);
		expect(result.current.matchedCase).toBeNull();
	});

	it("does not fire a query when the case number is empty", async () => {
		const { result } = renderHook(() => useCaseNumberAvailability(""), {
			wrapper: createWrapper(),
		});

		// Should immediately report not checking and not existing
		expect(result.current.isChecking).toBe(false);
		expect(result.current.alreadyExists).toBe(false);
		expect(result.current.matchedCase).toBeNull();
		expect(checkCaseNumberExists).not.toHaveBeenCalled();
	});
});
