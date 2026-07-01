import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/defendants/components/DefendantsTable", () => ({
	DefendantsTable: () => <div data-testid="defendants-table" />,
}));
vi.mock("@/features/defendants/components/DefendantsFilters", () => ({
	DefendantsFilters: () => <div data-testid="defendants-filters" />,
}));

const Defendants = await import("./Defendants").then((m) => m.default);

describe("Defendants Page", () => {
	it("renders the header, filters, table, and actions", () => {
		renderPage(<Defendants />);

		expect(
			screen.getByRole("heading", { name: /defendants/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("defendants-filters")).toBeInTheDocument();
		expect(screen.getByTestId("defendants-table")).toBeInTheDocument();
		expect(screen.getByText("Add Defendant")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Defendants />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
