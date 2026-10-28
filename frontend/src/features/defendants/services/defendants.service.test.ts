import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted so the vi.mock factory can reference it without a TDZ error.
const { apiMock } = vi.hoisted(() => ({
	apiMock: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
		getBlob: vi.fn(),
		postBlob: vi.fn(),
		getPublic: vi.fn(),
		postPublic: vi.fn(),
		setUnauthorizedHandler: vi.fn(),
	},
}));

// Replace only apiClient; keep ENDPOINTS real.
vi.mock("@/shared/services/api", async (importActual) => ({
	...(await importActual<typeof import("@/shared/services/api")>()),
	apiClient: apiMock,
}));

import { getDefendants, searchDefendants } from "./defendants.service";
import { ENDPOINTS } from "@/shared/services/api";

const paramsOf = (call: unknown[]) =>
	(call[1] as { params: Record<string, unknown> }).params;

describe("defendants.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.get.mockResolvedValue({ results: [], count: 0 });
	});

	it("asks for selectable defendants only when searching for a dropdown", async () => {
		await searchDefendants({ search: "jane", limit: 6 });

		expect(apiMock.get).toHaveBeenCalledWith(
			ENDPOINTS.DEFENDANTS.LIST,
			expect.anything()
		);
		expect(paramsOf(apiMock.get.mock.calls[0])).toEqual({
			search: "jane",
			limit: 6,
			selectable: "true",
		});
	});

	it("keeps placeholder defendants visible on the Defendants page list", async () => {
		await getDefendants({ page: 2, search: "unknown" });

		const params = paramsOf(apiMock.get.mock.calls[0]);
		expect(params).toEqual({ page: 2, search: "unknown" });
		expect(params).not.toHaveProperty("selectable");
	});
});
