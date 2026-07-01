import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/batches", () => ({
	useCreateBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The table and filters fetch their own data; stub them so this test stays
// focused on the page shell (header, batch-selection control, a11y).
vi.mock("@/features/cases/components/CasesTable", () => ({
	CasesTable: () => <div data-testid="cases-table" />,
}));
vi.mock("@/features/cases/components/CasesFilters", () => ({
	CasesFilters: () => <div data-testid="cases-filters" />,
}));

const Cases = await import("./Cases").then((m) => m.default);

describe("Cases Page", () => {
	it("renders the header, filters, table and batch-selection control", () => {
		renderPage(<Cases />);

		expect(
			screen.getByRole("heading", { name: /cases/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("cases-filters")).toBeInTheDocument();
		expect(screen.getByTestId("cases-table")).toBeInTheDocument();
		expect(screen.getByText("New Case")).toBeInTheDocument();
	});

	it("disables the Create Batch button when nothing is selected", () => {
		renderPage(<Cases />);

		expect(
			screen.getByRole("button", { name: /create batch/i })
		).toBeDisabled();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Cases />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
