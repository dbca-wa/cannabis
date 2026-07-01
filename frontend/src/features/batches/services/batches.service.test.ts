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

// Replace only apiClient; keep API_CONFIG + ENDPOINTS real.
vi.mock("@/shared/services/api", async (importActual) => ({
	...(await importActual<typeof import("@/shared/services/api")>()),
	apiClient: apiMock,
}));

import {
	getBatches,
	getBatch,
	createBatch,
	recordInvoiceRaised,
	unsetInvoiceRaised,
	deleteBatch,
	downloadBatchZip,
	getBatchExportUrl,
} from "./batches.service";
import { ENDPOINTS, API_CONFIG } from "@/shared/services/api";

describe("batches.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists batches with the default ordering", async () => {
		apiMock.get.mockResolvedValue([]);
		await getBatches();
		expect(apiMock.get).toHaveBeenCalledWith(
			`${ENDPOINTS.BATCHES.LIST}?ordering=-created_at`
		);
	});

	it("lists batches with a custom ordering", async () => {
		apiMock.get.mockResolvedValue([]);
		await getBatches("bag_count");
		expect(apiMock.get).toHaveBeenCalledWith(
			`${ENDPOINTS.BATCHES.LIST}?ordering=bag_count`
		);
	});

	it("fetches a single batch by id", async () => {
		apiMock.get.mockResolvedValue({ id: 7 });
		await getBatch(7);
		expect(apiMock.get).toHaveBeenCalledWith(ENDPOINTS.BATCHES.DETAIL(7));
	});

	it("creates a batch from the selected cases", async () => {
		apiMock.post.mockResolvedValue({ id: 1, batch_number: "CB-1" });
		await createBatch({ case_ids: [1, 2, 3] });
		expect(apiMock.post).toHaveBeenCalledWith(ENDPOINTS.BATCHES.CREATE, {
			case_ids: [1, 2, 3],
		});
	});

	it("records an invoice-raised number", async () => {
		apiMock.post.mockResolvedValue({ id: 5 });
		await recordInvoiceRaised(5, { invoice_raised_number: "6062" });
		expect(apiMock.post).toHaveBeenCalledWith(
			ENDPOINTS.BATCHES.INVOICE_RAISED(5),
			{ invoice_raised_number: "6062" }
		);
	});

	it("unsets the invoice-raised number via DELETE", async () => {
		apiMock.delete.mockResolvedValue({ id: 5 });
		await unsetInvoiceRaised(5);
		expect(apiMock.delete).toHaveBeenCalledWith(
			ENDPOINTS.BATCHES.INVOICE_RAISED(5)
		);
	});

	it("deletes a batch", async () => {
		apiMock.delete.mockResolvedValue(undefined);
		await deleteBatch(9);
		expect(apiMock.delete).toHaveBeenCalledWith(ENDPOINTS.BATCHES.DELETE(9));
	});

	it("downloads the batch ZIP as a blob", async () => {
		const blob = new Blob(["zip"]);
		apiMock.getBlob.mockResolvedValue(blob);
		const result = await downloadBatchZip(2);
		expect(apiMock.getBlob).toHaveBeenCalledWith(ENDPOINTS.BATCHES.DOWNLOAD(2));
		expect(result).toBe(blob);
	});

	it("builds an absolute export URL from the base URL and endpoint", () => {
		expect(getBatchExportUrl()).toBe(
			`${API_CONFIG.BASE_URL}${ENDPOINTS.BATCHES.EXPORT}`
		);
	});
});
