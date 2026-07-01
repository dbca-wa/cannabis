/**
 * Reusable API client stub for deterministic, offline tests.
 *
 * Mirrors the full surface of `ApiClientService` so that mocking the
 * `@/shared/services/api` barrel never strips a method the app relies on
 * (e.g. `setUnauthorizedHandler`, which the root store wires up at startup).
 *
 * Usage:
 *   vi.mock("@/shared/services/api", async (importActual) => {
 *     const actual = await importActual<typeof import("@/shared/services/api")>();
 *     const { createApiClientMock } = await import("@/test/mocks/api.mock");
 *     return { ...actual, apiClient: createApiClientMock() };
 *   });
 */

import { vi } from "vitest";

export const createApiClientMock = () => ({
	get: vi.fn().mockResolvedValue(undefined),
	post: vi.fn().mockResolvedValue(undefined),
	put: vi.fn().mockResolvedValue(undefined),
	patch: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
	getBlob: vi.fn().mockResolvedValue(new Blob()),
	postBlob: vi.fn().mockResolvedValue(new Blob()),
	getPublic: vi.fn().mockResolvedValue(undefined),
	postPublic: vi.fn().mockResolvedValue(undefined),
	setUnauthorizedHandler: vi.fn(),
});

export type ApiClientMock = ReturnType<typeof createApiClientMock>;
