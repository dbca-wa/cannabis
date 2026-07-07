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

const Settings = await import("./Financials").then((m) => m.default);

describe("Settings Page", () => {
	it("renders settings for staff users", () => {
		authState.user = { id: 1, is_staff: true, is_superuser: false };
		renderPage(<Settings />);

		expect(
			screen.getByRole("heading", { name: /settings/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("settings-content")).toBeInTheDocument();
	});

	it("redirects non-staff users away from the page", () => {
		authState.user = { id: 2, is_staff: false, is_superuser: false };
		renderPage(<Settings />);

		expect(
			screen.queryByRole("heading", { name: /settings/i })
		).not.toBeInTheDocument();
		expect(screen.queryByTestId("settings-content")).not.toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		authState.user = { id: 1, is_staff: true, is_superuser: false };
		const { container } = renderPage(<Settings />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
