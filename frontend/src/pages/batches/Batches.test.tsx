import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const mutationStub = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock("@/features/batches", () => ({
	useBatches: () => ({ data: [], isLoading: false }),
	useDeleteBatch: mutationStub,
	useRecordInvoiceRaised: mutationStub,
	useUnsetInvoiceRaised: mutationStub,
	downloadBatchZip: vi.fn(),
	getBatchExportUrl: () => "/api/v1/batches/export",
}));

vi.mock("@/features/police/hooks/useOfficerById", () => ({
	useOfficerById: () => ({ data: null }),
}));

vi.mock("@/shared/components/police", () => ({
	OfficerSearchComboBox: () => <div data-testid="officer-search" />,
}));

const Batches = await import("./Batches").then((m) => m.default);

describe("Batches Page", () => {
	it("renders the header and empty state", () => {
		renderPage(<Batches />);

		expect(
			screen.getByRole("heading", { name: /batches/i, level: 1 })
		).toBeInTheDocument();
		expect(
			screen.getByText(/no batches yet\. create one from the cases page/i)
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Batches />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
