import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const activateInvitation = vi.fn();

vi.mock("@/features/auth/services/auth.service", () => ({
	activateInvitation: (token: string) => activateInvitation(token),
}));

const InviteActivation = await import("./InviteActivation").then(
	(m) => m.default
);

const renderAt = (path: string) =>
	renderPage(
		<Routes>
			<Route
				path="/auth/activate-invite/:token"
				element={<InviteActivation />}
			/>
			<Route path="/auth/activate-invite" element={<InviteActivation />} />
		</Routes>,
		{ initialEntries: [path] }
	);

describe("InviteActivation Page", () => {
	it("shows an error when no token is present", async () => {
		renderAt("/auth/activate-invite");

		expect(
			await screen.findByText(/invalid invitation link - no token provided/i)
		).toBeInTheDocument();
	});

	it("activates the invitation and shows the welcome state", async () => {
		activateInvitation.mockResolvedValueOnce({
			user: {
				id: 1,
				email: "newuser@dbca.wa.gov.au",
				full_name: "New User",
				role: "botanist",
			},
			access: "access-token",
			refresh: "refresh-token",
			token_type: "Bearer",
			expires_in: 3600,
			temporary_password: "Temp-pass-1!",
			requires_password_change: true,
		});

		renderAt("/auth/activate-invite/valid-token-123");

		expect(
			await screen.findByText(/welcome to cannabis management system/i)
		).toBeInTheDocument();
		expect(screen.getByText("New User")).toBeInTheDocument();
		expect(activateInvitation).toHaveBeenCalledWith("valid-token-123");
	});

	it("has no accessibility violations in the error state", async () => {
		const { container } = renderAt("/auth/activate-invite");
		await screen.findByText(/invalid invitation link/i);

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
