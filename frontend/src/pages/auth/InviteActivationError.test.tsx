import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import InviteActivationError from "./InviteActivationError";

describe("InviteActivationError Page", () => {
	it("renders the failure message and expired guidance", () => {
		renderPage(<InviteActivationError />, {
			initialEntries: [
				{
					pathname: "/auth/invite-error",
					state: { error: "This invitation has expired" },
				},
			],
		});

		expect(
			screen.getByText(/invitation activation failed/i)
		).toBeInTheDocument();
		// Exact-string match targets the alert (the guidance paragraph contains
		// additional text, so it is not an exact match).
		expect(screen.getByText("This invitation has expired")).toBeInTheDocument();
		expect(
			screen.getByText(/contact your administrator for a new invitation/i)
		).toBeInTheDocument();
		// Expired invites are not retryable — only the login action is offered.
		expect(
			screen.getByRole("button", { name: /go to login/i })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /try again/i })
		).not.toBeInTheDocument();
	});

	it("offers a retry for a retryable error with a token", () => {
		renderPage(<InviteActivationError />, {
			initialEntries: [
				{
					pathname: "/auth/invite-error",
					state: { error: "Something went wrong", token: "abc123" },
				},
			],
		});

		expect(
			screen.getByRole("button", { name: /try again/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<InviteActivationError />, {
			initialEntries: [
				{
					pathname: "/auth/invite-error",
					state: { error: "This invitation has expired" },
				},
			],
		});

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
