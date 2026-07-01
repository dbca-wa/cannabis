import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import NotFound from "./NotFound";

describe("NotFound Page", () => {
	it("renders the 404 message and a link home", () => {
		renderPage(<NotFound />);

		expect(screen.getByText("404")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /page not found/i })
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
			"href",
			"/"
		);
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<NotFound />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
