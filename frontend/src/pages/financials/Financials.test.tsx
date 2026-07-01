import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const authState: { user: Record<string, unknown> } = {
	user: { id: 1, is_staff: true, is_superuser: false },
};

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

vi.mock("@/features/admin/components/SettingsContent", () => ({
	default: () => <div data-testid="settings-content" />,
}));

const Financials = await import("./Financials").then((m) => m.default);

describe("Financials Page", () => {
	it("renders cost settings for staff users", () => {
		authState.user = { id: 1, is_staff: true, is_superuser: false };
		renderPage(<Financials />);

		expect(
			screen.getByRole("heading", { name: /financials/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("settings-content")).toBeInTheDocument();
	});

	it("redirects non-staff users away from the page", () => {
		authState.user = { id: 2, is_staff: false, is_superuser: false };
		renderPage(<Financials />);

		expect(
			screen.queryByRole("heading", { name: /financials/i })
		).not.toBeInTheDocument();
		expect(screen.queryByTestId("settings-content")).not.toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		authState.user = { id: 1, is_staff: true, is_superuser: false };
		const { container } = renderPage(<Financials />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
