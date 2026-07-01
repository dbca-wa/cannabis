import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: { id: 1, email: "me@dbca.wa.gov.au" } }),
}));

vi.mock("@/shared/hooks/data", () => ({
	useSystemSettings: () => ({
		data: { ocr_enabled: false },
		isLoading: false,
	}),
}));

// Keep the real ENDPOINTS/config; stub apiClient so the root store still wires
// its unauthorized handler and no real requests fire.
vi.mock("@/shared/services/api", async (importActual) => {
	const actual = await importActual<typeof import("@/shared/services/api")>();
	const { createApiClientMock } = await import("@/test/mocks/api.mock");
	return { ...actual, apiClient: createApiClientMock() };
});

const DevelopmentContent = await import("./DevelopmentContent").then(
	(m) => m.default
);

describe("DevelopmentContent (admin testing tools)", () => {
	it("renders the OCR feature toggle", () => {
		renderPage(<DevelopmentContent />);
		expect(screen.getByText(/priority 3 form ocr/i)).toBeInTheDocument();
		expect(
			screen.getByRole("switch", { name: /toggle priority 3 form ocr/i })
		).toBeInTheDocument();
	});

	it("renders the Test Invitation Email tool defaulting to the current user", () => {
		renderPage(<DevelopmentContent />);
		expect(screen.getByText(/test invitation email/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/recipient email/i)).toHaveValue(
			"me@dbca.wa.gov.au"
		);
		expect(
			screen.getByRole("button", { name: /send test email/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<DevelopmentContent />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
