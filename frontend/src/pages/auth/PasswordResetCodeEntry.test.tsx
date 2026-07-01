import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import PasswordResetCodeEntry from "./PasswordResetCodeEntry";

const renderWithEmail = () =>
	renderPage(<PasswordResetCodeEntry />, {
		initialEntries: [
			{
				pathname: "/auth/reset-code",
				state: { email: "user@dbca.wa.gov.au" },
			},
		],
	});

describe("PasswordResetCodeEntry Page", () => {
	it("renders the code entry form with the target email", () => {
		renderWithEmail();

		expect(
			screen.getByRole("heading", { name: /enter reset code/i })
		).toBeInTheDocument();
		expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
		expect(screen.getByText("user@dbca.wa.gov.au")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /verify code/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderWithEmail();
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
