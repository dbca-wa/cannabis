import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { ReactNode } from "react";
import type { Priority3Form } from "@/shared/types/backend-api.types";

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../services/forms.service", () => ({
	generateFormCertificate: vi.fn(),
	getCaseForms: vi.fn(),
	updateForm: vi.fn(),
}));

import { toast } from "sonner";
import {
	generateFormCertificate,
	getCaseForms,
} from "../services/forms.service";
import { useCaseCertificates } from "./useCaseCertificates";

const form = (id: number) =>
	({
		id,
		bags: [{ id, updated_at: "2026-10-01T00:00:00Z" }],
		certificate: null,
		marked_ready: false,
		additional_notes: null,
	}) as unknown as Priority3Form;

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useCaseCertificates generateAll", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("generates one form at a time in form order", async () => {
		// The server returns the forms out of order.
		vi.mocked(getCaseForms).mockResolvedValue([form(12), form(7), form(9)]);
		const started: number[] = [];
		let inFlight = 0;
		let maxInFlight = 0;
		vi.mocked(generateFormCertificate).mockImplementation(async (formId) => {
			started.push(formId);
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 5));
			inFlight -= 1;
			return {} as never;
		});

		const { result } = renderHook(() => useCaseCertificates(1), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.pendingForms).toHaveLength(3));

		await act(async () => {
			await result.current.generateAll();
		});

		expect(started).toEqual([7, 9, 12]);
		expect(maxInFlight).toBe(1);
		expect(toast.success).toHaveBeenCalledWith("All certificates generated");
	});

	it("carries on after a failure and reports it", async () => {
		vi.mocked(getCaseForms).mockResolvedValue([form(1), form(2)]);
		vi.mocked(generateFormCertificate)
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce({} as never);

		const { result } = renderHook(() => useCaseCertificates(1), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.pendingForms).toHaveLength(2));

		let settled: PromiseSettledResult<unknown>[] = [];
		await act(async () => {
			settled = await result.current.generateAll();
		});

		expect(settled.map((r) => r.status)).toEqual(["rejected", "fulfilled"]);
		expect(generateFormCertificate).toHaveBeenCalledTimes(2);
		expect(toast.error).toHaveBeenCalledWith("Failed to generate certificate");
		// No "all generated" message when one failed.
		expect(toast.success).not.toHaveBeenCalledWith(
			"All certificates generated"
		);
	});
});
