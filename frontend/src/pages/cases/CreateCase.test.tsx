import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const createCase = vi.fn(
	(_data: unknown, options: { onSuccess: (c: { id: number }) => void }) =>
		options.onSuccess({ id: 42 })
);
vi.mock("@/features/cases/hooks/useCases", () => ({
	useCases: () => ({ createCase }),
}));

const formStore = {
	formData: {},
	selectedDefendants: [],
	selectedOfficers: {},
	selectedBotanist: null,
	selectedStation: null,
	resetForm: vi.fn(),
	loadDraft: vi.fn(),
	getCaseCreateRequest: vi.fn(() => ({})),
	clearDraft: vi.fn(),
	updateField: vi.fn(),
};
vi.mock("@/features/cases/hooks/useCaseFormStore", () => ({
	useCaseFormStore: () => formStore,
}));

vi.mock("@/features/cases/components/providers/CaseStoresProvider", () => ({
	CaseStoresProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/features/cases/components/forms/page/CaseCreationForm", () => ({
	CaseCreationForm: ({ onSubmit }: { onSubmit: () => void }) => (
		<div data-testid="case-creation-form">
			<button type="button" onClick={onSubmit}>
				Create Case
			</button>
		</div>
	),
}));

const CreateCase = await import("./CreateCase").then((m) => m.CreateCase);

describe("CreateCase Page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the case creation form", () => {
		renderPage(<CreateCase />);
		expect(screen.getByTestId("case-creation-form")).toBeInTheDocument();
	});

	it("keeps the form as typed until the page leaves after creating", async () => {
		const user = userEvent.setup();
		const { unmount } = renderPage(<CreateCase />);
		// Reset once on arrival.
		expect(formStore.resetForm).toHaveBeenCalledTimes(1);

		await user.click(screen.getByRole("button", { name: "Create Case" }));

		// Clearing now would flash the emptied form, red with "required",
		// while the new case page loads.
		expect(createCase).toHaveBeenCalledOnce();
		expect(formStore.resetForm).toHaveBeenCalledTimes(1);
		expect(formStore.clearDraft).not.toHaveBeenCalled();

		unmount();

		expect(formStore.resetForm).toHaveBeenCalledTimes(2);
		expect(formStore.clearDraft).toHaveBeenCalledOnce();
	});

	it("keeps the draft when leaving without creating", () => {
		const { unmount } = renderPage(<CreateCase />);
		unmount();
		expect(formStore.clearDraft).not.toHaveBeenCalled();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<CreateCase />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
