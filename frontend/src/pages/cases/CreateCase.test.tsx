import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

vi.mock("@/features/cases/hooks/useCases", () => ({
	useCases: () => ({ createCase: vi.fn() }),
}));

vi.mock("@/features/cases/hooks/useCaseFormStore", () => ({
	useCaseFormStore: () => ({
		formData: {},
		selectedDefendants: [],
		selectedOfficers: {},
		selectedBotanist: null,
		selectedStation: null,
		getAutoPopulatedAdditionalNotes: () => "",
		resetForm: vi.fn(),
		loadDraft: vi.fn(),
		getCaseCreateRequest: vi.fn(() => ({})),
		clearDraft: vi.fn(),
	}),
}));

vi.mock("@/features/cases/components/providers/CaseStoresProvider", () => ({
	CaseStoresProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock(
	"@/features/cases/components/forms/wizard/CaseCreationWizardContainer",
	() => ({
		CaseCreationWizardContainer: () => (
			<div data-testid="case-creation-wizard" />
		),
	})
);

const CreateCase = await import("./CreateCase").then((m) => m.CreateCase);

describe("CreateCase Page", () => {
	it("renders the case creation wizard", () => {
		renderPage(<CreateCase />);
		expect(screen.getByTestId("case-creation-wizard")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<CreateCase />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
