import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../services/batches.service", () => ({
	getBatches: vi.fn(),
	getBatch: vi.fn(),
	createBatch: vi.fn(),
	recordInvoiceRaised: vi.fn(),
	unsetInvoiceRaised: vi.fn(),
	deleteBatch: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import { useBatches, useCreateBatch, batchesQueryKeys } from "./useBatches";
import * as batchesService from "../services/batches.service";

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

describe("useBatches hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("builds stable, ordering-scoped query keys", () => {
		expect(batchesQueryKeys.list("-created_at")).toEqual([
			"batches",
			"list",
			"-created_at",
		]);
		expect(batchesQueryKeys.detail(7)).toEqual(["batches", "detail", 7]);
	});

	it("fetches the batch list with the default ordering", async () => {
		vi.mocked(batchesService.getBatches).mockResolvedValue([
			{ id: 1, batch_number: "CB-1" },
		] as never);

		const { result } = renderHook(() => useBatches(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual([{ id: 1, batch_number: "CB-1" }]);
		expect(batchesService.getBatches).toHaveBeenCalledWith("-created_at");
	});

	it("creates a batch through the mutation", async () => {
		vi.mocked(batchesService.createBatch).mockResolvedValue({
			id: 2,
			batch_number: "CB-2",
		} as never);

		const { result } = renderHook(() => useCreateBatch(), {
			wrapper: createWrapper(),
		});

		result.current.mutate({ certificate_ids: [1, 2] });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(batchesService.createBatch).toHaveBeenCalledWith({
			certificate_ids: [1, 2],
		});
	});
});
