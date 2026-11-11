import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const getInvitation = vi.fn();
const activateInvitation = vi.fn();

vi.mock("@/features/auth/services/auth.service", () => ({
	getInvitation: (token: string) => getInvitation(token),
	activateInvitation: (token: string) => activateInvitation(token),
}));

const InviteActivation = await import("./InviteActivation").then(
	(m) => m.default
);

const INVITE = {
	email: "newuser@dbca.wa.gov.au",
	given_names: "New",
	last_name: "User",
	role: "botanist",
	role_display: "Approved Botanist",
	invited_by: "Sam Taylor",
	expires_at: "2026-11-25T02:00:00Z",
};

const renderAt = (path: string) =>
	renderPage(
		<Routes>
			<Route
				path="/auth/activate-invite/:token"
				element={<InviteActivation />}
			/>
			<Route path="/auth/activate-invite" element={<InviteActivation />} />
			<Route path="/auth/invite-error" element={<p>invite error page</p>} />
		</Routes>,
		{ initialEntries: [path] }
	);

describe("InviteActivation Page", () => {
	beforeEach(() => {
		getInvitation.mockReset();
		activateInvitation.mockReset();
	});

	it("shows an error when no token is present", async () => {
		renderAt("/auth/activate-invite");

		expect(
			await screen.findByText(/invalid invitation link - no token provided/i)
		).toBeInTheDocument();
	});

	it("shows who the invitation is for without accepting it", async () => {
		getInvitation.mockResolvedValueOnce(INVITE);

		renderAt("/auth/activate-invite/valid-token-123");

		expect(await screen.findByText("New User")).toBeInTheDocument();
		expect(screen.getByText("Approved Botanist")).toBeInTheDocument();
		expect(screen.getByText(/sam taylor has invited you/i)).toBeInTheDocument();
		expect(getInvitation).toHaveBeenCalledWith("valid-token-123");
		// Opening the link never accepts the invitation.
		expect(activateInvitation).not.toHaveBeenCalled();
	});

	it("accepts the invitation when the person continues", async () => {
		const user = userEvent.setup();
		getInvitation.mockResolvedValueOnce(INVITE);
		// Never resolves, so the page stays put instead of navigating away.
		activateInvitation.mockReturnValueOnce(new Promise(() => {}));

		renderAt("/auth/activate-invite/valid-token-123");
		await user.click(
			await screen.findByRole("button", { name: "Set Up Password Now" })
		);

		expect(activateInvitation).toHaveBeenCalledWith("valid-token-123");
		expect(
			screen.getByRole("button", { name: /setting up your account/i })
		).toBeDisabled();
	});

	it("sends a used or expired invitation to the invitation error page", async () => {
		getInvitation.mockRejectedValueOnce(
			new Error("This invitation has already been used.")
		);

		renderAt("/auth/activate-invite/used-token");

		expect(await screen.findByText("invite error page")).toBeInTheDocument();
	});

	it("has no accessibility violations when showing the invitation", async () => {
		getInvitation.mockResolvedValueOnce(INVITE);
		const { container } = renderAt("/auth/activate-invite/valid-token-123");
		await screen.findByText("New User");

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	it("has no accessibility violations in the error state", async () => {
		const { container } = renderAt("/auth/activate-invite");
		await screen.findByText(/invalid invitation link/i);

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
