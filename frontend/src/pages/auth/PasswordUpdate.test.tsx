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

const PasswordUpdate = await import("./PasswordUpdate").then((m) => m.default);

describe("PasswordUpdate Page", () => {
	it("renders the change-password form for an authenticated user", () => {
		renderPage(<PasswordUpdate />);

		expect(
			screen.getByRole("heading", { name: /change password/i })
		).toBeInTheDocument();
		expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
		expect(screen.getByLabelText("New Password")).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
	});

	it("renders the first-time setup form without a current-password field", () => {
		renderPage(<PasswordUpdate />, {
			initialEntries: [
				{ pathname: "/auth/password-update", state: { isFirstTime: true } },
			],
		});

		expect(
			screen.getByRole("heading", { name: /set your password/i })
		).toBeInTheDocument();
		expect(
			screen.queryByLabelText(/current password/i)
		).not.toBeInTheDocument();
		expect(screen.getByLabelText("New Password")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<PasswordUpdate />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
