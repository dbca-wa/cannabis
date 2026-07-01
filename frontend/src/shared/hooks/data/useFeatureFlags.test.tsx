import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/services", () => ({
	SystemSettingsService: {
		getFeatureFlags: vi.fn(),
	},
}));

import { useFeatureFlags, useOcrEnabled } from "./useFeatureFlags";
import { SystemSettingsService } from "@/shared/services";

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

describe("useFeatureFlags", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the feature flags from the API", async () => {
		vi.mocked(SystemSettingsService.getFeatureFlags).mockResolvedValue({
			ocr_enabled: true,
		});

		const { result } = renderHook(() => useFeatureFlags(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.ocr_enabled).toBe(true);
	});

	it("useOcrEnabled reflects the flag, defaulting to false before load", async () => {
		vi.mocked(SystemSettingsService.getFeatureFlags).mockResolvedValue({
			ocr_enabled: true,
		});

		const { result } = renderHook(() => useOcrEnabled(), {
			wrapper: createWrapper(),
		});

		// Defaults to false until the query resolves.
		expect(result.current).toBe(false);
		await waitFor(() => expect(result.current).toBe(true));
	});
});
