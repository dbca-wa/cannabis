import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../services/users.service", () => ({
	searchUsers: vi.fn(),
}));

// Collapse the debounce and cache configs so queries fire synchronously.
vi.mock("@/shared/hooks/core", () => ({
	useDebounce: (value: unknown) => value,
	cacheConfig: { search: {}, initial: {} },
	debounceConfig: { standard: 0 },
}));

import { useUserSearch } from "./useUserSearch";
import * as usersService from "../services/users.service";

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

describe("useUserSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("runs a search query when a search term is provided", async () => {
		vi.mocked(usersService.searchUsers).mockResolvedValue({
			results: [{ id: 1, full_name: "Jane Botanist" }],
			count: 1,
		} as never);

		const { result } = renderHook(() => useUserSearch({ query: "jane" }), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.data).toBeDefined());
		expect(usersService.searchUsers).toHaveBeenCalledWith({
			query: "jane",
			role: undefined,
			exclude: [],
			limit: 6,
		});
		expect(result.current.data?.count).toBe(1);
	});

	it("loads initial data when there is no search term", async () => {
		vi.mocked(usersService.searchUsers).mockResolvedValue({
			results: [{ id: 2, full_name: "Sam Finance" }],
			count: 1,
		} as never);

		const { result } = renderHook(() => useUserSearch({}), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.hasInitialData).toBe(true));
		expect(usersService.searchUsers).toHaveBeenCalledWith({
			query: "",
			role: undefined,
			exclude: [],
			limit: 6,
		});
	});
});
