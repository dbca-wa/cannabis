import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({
		user: {
			id: 1,
			email: "user@dbca.wa.gov.au",
			full_name: "Test User",
			given_names: "Test",
		},
		isAuthenticated: true,
	}),
}));

const ChangePassword = await import("./ChangePassword").then((m) => m.default);

describe("ChangePassword Page", () => {
	it("renders the page header and the embedded password form", () => {
		renderPage(<ChangePassword />);

		expect(
			screen.getByRole("heading", { name: "Change Password", level: 1 })
		).toBeInTheDocument();
		expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
		expect(screen.getByLabelText("New Password")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<ChangePassword />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
