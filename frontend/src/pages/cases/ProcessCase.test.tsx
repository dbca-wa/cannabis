import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const caseState: { data: unknown; isLoading: boolean; isError: boolean } = {
	data: {
		id: 1,
		case_number: "CAN-25-0001",
		phase: "assessment",
		bags: [],
		certificates: [],
	},
	isLoading: false,
	isError: false,
};

vi.mock("@/features/cases/hooks/useCases", () => ({
	useCaseById: () => caseState,
	useCases: () => ({
		updateCase: vi.fn(),
		executeWorkflowAction: vi.fn(),
		deleteCase: vi.fn(),
	}),
}));

vi.mock("@/features/cases/hooks/useDrugBags", () => ({
	useDrugBags: () => ({ createDrugBag: vi.fn() }),
}));

vi.mock("@/features/cases/components/providers/CaseStoresProvider", () => ({
	CaseStoresProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock(
	"@/features/cases/components/forms/wizard/CaseProcessingWizardContainer",
	() => ({
		CaseProcessingWizardContainer: () => (
			<div data-testid="case-processing-wizard" />
		),
	})
);

const ProcessCase = await import("./ProcessCase").then((m) => m.ProcessCase);

describe("ProcessCase Page", () => {
	it("renders the processing wizard once the case has loaded", () => {
		caseState.isLoading = false;
		caseState.isError = false;
		renderPage(<ProcessCase />);
		expect(screen.getByTestId("case-processing-wizard")).toBeInTheDocument();
	});

	it("shows a not-found state when the case fails to load", () => {
		caseState.isError = true;
		try {
			renderPage(<ProcessCase />);
			expect(screen.getByText(/case not found/i)).toBeInTheDocument();
			expect(
				screen.queryByTestId("case-processing-wizard")
			).not.toBeInTheDocument();
		} finally {
			caseState.isError = false;
		}
	});

	it("has no accessibility violations", async () => {
		caseState.isLoading = false;
		caseState.isError = false;
		const { container } = renderPage(<ProcessCase />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
