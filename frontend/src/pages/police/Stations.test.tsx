import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/police/components/stations/PoliceStationsTable", () => ({
	PoliceStationsTable: () => <div data-testid="stations-table" />,
}));
vi.mock("@/features/police/components/stations/StationsFilters", () => ({
	StationsFilters: () => <div data-testid="stations-filters" />,
}));

const Stations = await import("./Stations").then((m) => m.default);

describe("Stations Page", () => {
	it("renders the header, filters, table, and actions", () => {
		renderPage(<Stations />);

		expect(
			screen.getByRole("heading", { name: /stations/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("stations-filters")).toBeInTheDocument();
		expect(screen.getByTestId("stations-table")).toBeInTheDocument();
		expect(screen.getByText("Add Station")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Stations />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
