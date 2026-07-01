import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const caseState: {
	data: unknown;
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => void;
} = {
	data: { id: 1, case_number: "CAN-25-0001" },
	isLoading: false,
	isError: false,
	error: null,
	refetch: vi.fn(),
};

vi.mock("@/features/cases/hooks/useCases", () => ({
	useCaseById: () => caseState,
	useCases: () => ({ updateCase: vi.fn() }),
}));

vi.mock("@/features/cases/hooks/useCaseFormStore", () => ({
	useCaseFormStore: () => ({
		loadFromCase: vi.fn(),
		getCaseCreateRequest: vi.fn(() => ({})),
		saveDraft: vi.fn(),
		clearDraft: vi.fn(),
	}),
}));

vi.mock("@/features/cases/components/providers/CaseStoresProvider", () => ({
	CaseStoresProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/features/cases/components/forms/CreateCaseForm", () => ({
	CreateCaseForm: () => <div data-testid="create-case-form" />,
}));

const EditCase = await import("./EditCase").then((m) => m.EditCase);

describe("EditCase Page", () => {
	it("renders the edit form once the case has loaded", () => {
		caseState.isLoading = false;
		caseState.isError = false;
		renderPage(<EditCase />);

		expect(screen.getByTestId("create-case-form")).toBeInTheDocument();
		expect(screen.getAllByText("Edit Case").length).toBeGreaterThan(0);
	});

	it("shows a loading state while fetching", () => {
		caseState.isLoading = true;
		try {
			renderPage(<EditCase />);
			expect(screen.getByText(/loading/i)).toBeInTheDocument();
			expect(screen.queryByTestId("create-case-form")).not.toBeInTheDocument();
		} finally {
			caseState.isLoading = false;
		}
	});

	it("shows an error state when the case fails to load", () => {
		caseState.isError = true;
		caseState.error = new Error("boom");
		try {
			renderPage(<EditCase />);
			expect(screen.getByText(/failed to load case/i)).toBeInTheDocument();
		} finally {
			caseState.isError = false;
			caseState.error = null;
		}
	});

	it("has no accessibility violations", async () => {
		caseState.isLoading = false;
		caseState.isError = false;
		const { container } = renderPage(<EditCase />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
