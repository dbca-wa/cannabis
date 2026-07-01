import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import PasswordResetSuccess from "./PasswordResetSuccess";

const renderWithEmail = () =>
	renderPage(<PasswordResetSuccess />, {
		initialEntries: [
			{
				pathname: "/auth/reset-success",
				state: { email: "user@dbca.wa.gov.au" },
			},
		],
	});

describe("PasswordResetSuccess Page", () => {
	it("confirms the code was sent and offers next steps", () => {
		renderWithEmail();

		expect(
			screen.getByRole("heading", { name: /reset code sent/i })
		).toBeInTheDocument();
		expect(screen.getByText("user@dbca.wa.gov.au")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /enter reset code/i })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /resend code/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderWithEmail();
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
