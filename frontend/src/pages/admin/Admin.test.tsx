import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const accessResult: { allowed: boolean; reason?: string } = { allowed: true };

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: { id: 1, is_staff: true, is_superuser: true } }),
}));

vi.mock("@/features/admin/services/security.service", () => ({
	securityService: {
		checkAdminAccess: () => accessResult,
		logSecurityEvent: vi.fn(),
	},
}));

vi.mock("@/features/admin/components/DevelopmentContent", () => ({
	default: () => <div data-testid="development-content" />,
}));

const Admin = await import("./Admin").then((m) => m.default);

describe("Admin (Testing) Page", () => {
	it("renders developer tools for an authorised admin", () => {
		accessResult.allowed = true;
		renderPage(<Admin />);

		expect(
			screen.getByRole("heading", { name: /testing/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("development-content")).toBeInTheDocument();
	});

	it("blocks access for unauthorised users", () => {
		accessResult.allowed = false;
		accessResult.reason = "You don't have permission to access admin settings.";
		try {
			renderPage(<Admin />);
			expect(
				screen.getByText(/don't have permission to access admin settings/i)
			).toBeInTheDocument();
			expect(
				screen.queryByTestId("development-content")
			).not.toBeInTheDocument();
		} finally {
			accessResult.allowed = true;
			delete accessResult.reason;
		}
	});

	it("has no accessibility violations", async () => {
		accessResult.allowed = true;
		const { container } = renderPage(<Admin />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
