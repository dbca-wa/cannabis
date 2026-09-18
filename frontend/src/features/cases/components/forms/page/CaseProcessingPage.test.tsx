import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { Priority3Form } from "@/shared/types/backend-api.types";

// The sections own their own data fetching; this suite is about the page shell —
// the section index, the completion ticks and the finalise gate.
vi.mock("../wizard/steps/CaseCreationSummaryStep", () => ({
	CaseCreationSummaryStep: () => <div data-testid="details-section" />,
}));
vi.mock("../wizard/steps/AssessmentStep", () => ({
	AssessmentStep: () => <div data-testid="assessment-section" />,
}));
vi.mock("../wizard/steps/UnsignedCertificateStep", () => ({
	UnsignedCertificateStep: ({
		onAllReadyChange,
	}: {
		onAllReadyChange?: (ready: boolean) => void;
	}) => (
		<div data-testid="certificates-section">
			<button type="button" onClick={() => onAllReadyChange?.(true)}>
				mark all ready
			</button>
		</div>
	),
}));
vi.mock("../FormsNavigator", () => ({
	FormsNavigator: () => <div data-testid="forms-navigator" />,
}));
vi.mock("../wizard/WizardPreviewPanel", () => ({
	WizardPreviewPanel: () => <div data-testid="preview-panel" />,
}));
vi.mock("../wizard/FormPreviewToggle", () => ({
	FormPreviewToggle: () => <div data-testid="preview-toggle" />,
}));
// Mutable so the read-only lock can be exercised without re-importing the
// module, which would give the component a different store context.
const authState = { isAdmin: true };
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

const { CaseProcessingPage } = await import("./CaseProcessingPage");

const completeCaseData = () => ({
	id: 1,
	formId: 10,
	case_number: "IR 123456789",
	received: "2026-03-20T09:00:00Z",
	submitting_officer_id: 1,
	approved_botanist_id: 2,
	bags: [{ id: 1 }],
	phase: "assessment",
});

const assessedForm = (id: number, certificate: unknown = null) =>
	({
		id,
		bags: [{ id: id * 10, assessment: { determination: "cannabis_sativa" } }],
		certificate,
	}) as unknown as Priority3Form;

const renderPageWith = (
	overrides: {
		caseData?: Record<string, unknown> | null;
		forms?: Priority3Form[];
		onSubmit?: () => void;
	} = {}
) => {
	const onSubmit = overrides.onSubmit ?? vi.fn();
	const result = renderPage(
		<CaseProcessingPage
			caseData={overrides.caseData ?? completeCaseData()}
			caseId={1}
			activeFormId={10}
			forms={overrides.forms ?? [assessedForm(10, { id: 5 })]}
			onFieldChange={vi.fn()}
			onSubmit={onSubmit}
			onDiscard={vi.fn()}
		/>
	);
	return { ...result, onSubmit };
};

describe("CaseProcessingPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("layout", () => {
		it("shows all three sections at once, with no step navigation", () => {
			renderPageWith();

			expect(screen.getByTestId("details-section")).toBeInTheDocument();
			expect(screen.getByTestId("assessment-section")).toBeInTheDocument();
			expect(screen.getByTestId("certificates-section")).toBeInTheDocument();

			expect(
				screen.queryByRole("button", { name: /save and continue/i })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: /^back$/i })
			).not.toBeInTheDocument();
		});

		it("gives every section a heading", () => {
			renderPageWith();

			expect(
				screen.getByRole("heading", { name: /case details/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("heading", { name: /priority form assessment/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("heading", { name: /^certificates$/i })
			).toBeInTheDocument();
		});

		it("offers a section index that names each section", () => {
			renderPageWith();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByRole("button", { name: /case details/i })
			).toBeInTheDocument();
			expect(
				within(index).getByRole("button", { name: /assessment/i })
			).toBeInTheDocument();
			expect(
				within(index).getByRole("button", { name: /certificates/i })
			).toBeInTheDocument();
		});

		it("offers a way back to the cases list", () => {
			renderPageWith();

			expect(
				screen.getByRole("button", { name: /back to cases/i })
			).toBeInTheDocument();
		});
	});

	describe("completion indication", () => {
		it("reports a complete section as complete", () => {
			renderPageWith();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(within(index).getAllByText(/complete/i).length).toBeGreaterThan(0);
		});

		it("marks the details section as needing attention when data is missing", () => {
			renderPageWith({
				caseData: { ...completeCaseData(), case_number: "" },
			});

			expect(
				screen.getByText(/case details needs attention/i)
			).toBeInTheDocument();
		});

		it("says what is outstanding rather than only that a section is incomplete", () => {
			renderPageWith({
				caseData: { ...completeCaseData(), case_number: "" },
			});

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByText(/some required case details are missing/i)
			).toBeInTheDocument();
		});

		it("does not cry wolf on a case with no forms yet", () => {
			renderPageWith({ forms: [] });

			// Nothing has been started, so neither dependent section is an error.
			expect(screen.getByText(/assessment not started/i)).toBeInTheDocument();
			expect(screen.getByText(/certificates not started/i)).toBeInTheDocument();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getAllByText(/add a priority 3 form to begin/i).length
			).toBe(2);
		});

		it("asks for attention on the assessment once a form exists without bags", () => {
			renderPageWith({
				forms: [
					{ id: 10, bags: [], certificate: null } as unknown as Priority3Form,
				],
			});

			expect(
				screen.getByText(/assessment needs attention/i)
			).toBeInTheDocument();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByText(/every form needs at least one bag/i)
			).toBeInTheDocument();
		});

		it("asks for attention on certificates only once the assessment is done", () => {
			renderPageWith({ forms: [assessedForm(10, null)] });

			expect(
				screen.getByText(/certificates needs attention/i)
			).toBeInTheDocument();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByText(/every form needs a generated certificate/i)
			).toBeInTheDocument();
		});

		it("announces how many sections are complete", () => {
			renderPageWith();

			expect(screen.getByText(/3 of 3 sections complete/i)).toBeInTheDocument();
		});

		it("announces how many sections need attention", () => {
			renderPageWith({
				caseData: { ...completeCaseData(), case_number: "" },
			});

			expect(screen.getByText(/1 needing attention/i)).toBeInTheDocument();
		});
	});

	describe("finalising", () => {
		it("places the finalise action after the certificates section", () => {
			renderPageWith();

			const finalise = screen.getByRole("button", { name: /finalise case/i });
			const certificates = screen.getByTestId("certificates-section");

			// DOCUMENT_POSITION_FOLLOWING (4) means finalise comes after the
			// certificates section in document order — i.e. at the very bottom.
			expect(
				certificates.compareDocumentPosition(finalise) &
					Node.DOCUMENT_POSITION_FOLLOWING
			).toBeTruthy();
		});

		it("is blocked until every form has been marked ready", () => {
			renderPageWith();

			expect(
				screen.getByRole("button", { name: /finalise case/i })
			).toBeDisabled();
		});

		it("becomes available once the certificates report all forms ready", async () => {
			const user = userEvent.setup();
			renderPageWith();

			await user.click(screen.getByRole("button", { name: /mark all ready/i }));

			expect(
				screen.getByRole("button", { name: /finalise case/i })
			).toBeEnabled();
		});

		it("submits when everything is in order", async () => {
			const user = userEvent.setup();
			const { onSubmit } = renderPageWith();

			await user.click(screen.getByRole("button", { name: /mark all ready/i }));
			await user.click(screen.getByRole("button", { name: /finalise case/i }));

			expect(onSubmit).toHaveBeenCalledOnce();
		});

		it("does not submit while a section is incomplete", async () => {
			const user = userEvent.setup();
			const { onSubmit } = renderPageWith({
				caseData: { ...completeCaseData(), case_number: "" },
			});

			await user.click(screen.getByRole("button", { name: /mark all ready/i }));
			await user.click(screen.getByRole("button", { name: /finalise case/i }));

			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("is blocked when a form has no bags", () => {
			const emptyForm = { id: 10, bags: [], certificate: null };
			renderPageWith({
				forms: [emptyForm as unknown as Priority3Form],
			});

			expect(
				screen.getByRole("button", { name: /finalise case/i })
			).toBeDisabled();
		});
	});

	describe("read-only lock", () => {
		it("explains a completed form is read-only for non-administrators", () => {
			authState.isAdmin = false;
			try {
				renderPageWith({
					caseData: { ...completeCaseData(), phase: "complete" },
				});

				expect(screen.getByText(/complete and read-only/i)).toBeInTheDocument();
			} finally {
				authState.isAdmin = true;
			}
		});

		it("blocks finalising a completed form for non-administrators", () => {
			authState.isAdmin = false;
			try {
				renderPageWith({
					caseData: { ...completeCaseData(), phase: "complete" },
				});

				expect(
					screen.getByRole("button", { name: /finalise case/i })
				).toBeDisabled();
			} finally {
				authState.isAdmin = true;
			}
		});

		it("does not lock a completed form for an administrator", () => {
			renderPageWith({
				caseData: { ...completeCaseData(), phase: "complete" },
			});

			expect(
				screen.queryByText(/complete and read-only/i)
			).not.toBeInTheDocument();
		});
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPageWith();

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
