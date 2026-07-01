import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/police/components/officers/PoliceOfficersTable", () => ({
	PoliceOfficersTable: () => <div data-testid="officers-table" />,
}));

const Officers = await import("./Officers").then((m) => m.default);

describe("Officers Page", () => {
	it("renders the header, table, and merge/add actions", () => {
		renderPage(<Officers />);

		expect(
			screen.getByRole("heading", { name: /officers/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("officers-table")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /merge/i })).toBeInTheDocument();
		expect(screen.getByText("Add Officer")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Officers />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
