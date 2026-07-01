import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import Login from "./Login";

const loginFn = vi.fn();

// Auth hook is mocked so the page renders the unauthenticated form deterministically.
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({
		login: loginFn,
		isLoggingIn: false,
		loginError: null,
		user: null,
		isAuthenticated: false,
		isLoading: false,
	}),
}));

describe("Login Page", () => {
	it("renders the email/password form and the forgot-password link", () => {
		renderPage(<Login />);

		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /forgot your password\?/i })
		).toBeInTheDocument();
	});

	it("opens the forgot-password dialog when the link is clicked", async () => {
		const user = userEvent.setup();
		renderPage(<Login />);

		await user.click(
			screen.getByRole("button", { name: /forgot your password\?/i })
		);

		expect(
			await screen.findByRole("heading", { name: /reset your password/i })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /send reset code/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Login />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
