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
				report all ready
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
// The bulk certificate action beside Finalise reads its state from the forms
// passed to the page; only its actions are stubbed.
const certificateActions = {
	generateAll: vi.fn(async () => []),
	regenerateAll: vi.fn(async () => []),
	markAllReady: vi.fn(),
	isGenerating: false,
	isMarkingAllReady: false,
};
vi.mock("../../../hooks/useCaseCertificates", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("../../../hooks/useCaseCertificates")
	>()),
	useCaseCertificates: () => certificateActions,
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

const assessedForm = (
	id: number,
	certificate: unknown = null,
	markedReady = !!certificate
) =>
	({
		id,
		bags: [{ id: id * 10, assessment: { determination: "cannabis_sativa" } }],
		certificate,
		marked_ready: markedReady,
	}) as unknown as Priority3Form;

const renderPageWith = (
	overrides: {
		caseData?: Record<string, unknown> | null;
		forms?: Priority3Form[];
		onSubmit?: () => void;
		onDelete?: () => void;
	} = {}
) => {
	const onSubmit = overrides.onSubmit ?? vi.fn();
	const onDelete = overrides.onDelete ?? vi.fn();
	const result = renderPage(
		<CaseProcessingPage
			caseData={overrides.caseData ?? completeCaseData()}
			caseId={1}
			activeFormId={10}
			forms={overrides.forms ?? [assessedForm(10, { id: 5 })]}
			onFieldChange={vi.fn()}
			onSubmit={onSubmit}
			onDiscard={vi.fn()}
			onDelete={onDelete}
		/>
	);
	return { ...result, onSubmit, onDelete };
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

		it("offers a delete-case action that opens the confirmation", async () => {
			const user = userEvent.setup();
			const { onDelete } = renderPageWith();

			await user.click(screen.getByRole("button", { name: /delete case/i }));

			expect(onDelete).toHaveBeenCalledOnce();
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

		it("prompts for certificates without an alarm once the assessment is done", () => {
			renderPageWith({ forms: [assessedForm(10, null)] });

			expect(screen.getByText(/certificates not started/i)).toBeInTheDocument();
			expect(
				screen.queryByText(/certificates needs attention/i)
			).not.toBeInTheDocument();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByText(/generate a certificate for each form/i)
			).toBeInTheDocument();
		});

		it("does not tick certificates until each one is marked ready", () => {
			renderPageWith({ forms: [assessedForm(10, { id: 5 }, false)] });

			expect(
				screen.getByText(/certificates needs attention/i)
			).toBeInTheDocument();

			const index = screen.getByRole("navigation", { name: /case sections/i });
			expect(
				within(index).getByText(/mark each certificate ready/i)
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

			await user.click(
				screen.getByRole("button", { name: /report all ready/i })
			);

			expect(
				screen.getByRole("button", { name: /finalise case/i })
			).toBeEnabled();
		});

		it("submits when everything is in order", async () => {
			const user = userEvent.setup();
			const { onSubmit } = renderPageWith();

			await user.click(
				screen.getByRole("button", { name: /report all ready/i })
			);
			await user.click(screen.getByRole("button", { name: /finalise case/i }));

			expect(onSubmit).toHaveBeenCalledOnce();
		});

		it("does not submit while a section is incomplete", async () => {
			const user = userEvent.setup();
			const { onSubmit } = renderPageWith({
				caseData: { ...completeCaseData(), case_number: "" },
			});

			await user.click(
				screen.getByRole("button", { name: /report all ready/i })
			);
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

		it.each([
			["batching", /ready to batch from the cases page/i],
			["in_batch", /finalised and is in a batch/i],
			["complete", /this case is complete/i],
		])(
			"says where a finalised case stands instead of offering Finalise (%s)",
			(phase, message) => {
				renderPageWith({
					forms: [
						{
							...assessedForm(10, { id: 5 }),
							phase,
						} as unknown as Priority3Form,
					],
				});

				expect(
					screen.queryByRole("button", { name: /finalise case/i })
				).not.toBeInTheDocument();
				expect(screen.getByTestId("finalised-status")).toHaveTextContent(
					message
				);
			}
		);

		it("offers Finalise again when a new form is added after finalising", () => {
			renderPageWith({
				forms: [
					{
						...assessedForm(10, { id: 5 }),
						phase: "batching",
					} as unknown as Priority3Form,
					{
						...assessedForm(11, null),
						phase: "assessment",
					} as unknown as Priority3Form,
				],
			});

			expect(
				screen.getByRole("button", { name: /finalise case/i })
			).toBeInTheDocument();
		});
	});

	describe("certificate action beside Finalise", () => {
		const generated = (overrides: Record<string, unknown> = {}) => ({
			id: 5,
			pdf_url: "/media/certificate.pdf",
			pdf_file: "certificate.pdf",
			additional_notes: null,
			batch_id: null,
			updated_at: "2026-11-01T00:00:00Z",
			...overrides,
		});
		const formWith = (id: number, certificate: unknown, markedReady: boolean) =>
			({
				...assessedForm(id, certificate, markedReady),
				additional_notes: null,
			}) as unknown as Priority3Form;

		it("sits to the left of Finalise Case", () => {
			renderPageWith({ forms: [formWith(10, generated(), false)] });

			const action = screen.getByRole("button", { name: "Mark All Ready" });
			const finalise = screen.getByRole("button", { name: /finalise case/i });
			expect(
				action.compareDocumentPosition(finalise) &
					Node.DOCUMENT_POSITION_FOLLOWING
			).toBeTruthy();
		});

		it("generates the missing certificates first", async () => {
			const user = userEvent.setup();
			renderPageWith({
				forms: [formWith(10, generated(), true), formWith(11, null, false)],
			});

			await user.click(
				screen.getByRole("button", { name: "Generate All (1)" })
			);

			expect(certificateActions.generateAll).toHaveBeenCalledOnce();
		});

		it("regenerates when a certificate is out of date", async () => {
			const user = userEvent.setup();
			renderPageWith({
				forms: [
					formWith(10, generated({ needs_regeneration: true }), false),
					formWith(11, generated(), true),
				],
			});

			await user.click(screen.getByRole("button", { name: "Regenerate All" }));

			expect(certificateActions.regenerateAll).toHaveBeenCalledOnce();
			expect(
				screen.queryByRole("button", { name: "Mark All Ready" })
			).not.toBeInTheDocument();
		});

		it("marks every form ready once all are current", async () => {
			const user = userEvent.setup();
			renderPageWith({
				forms: [
					formWith(10, generated(), true),
					formWith(11, generated(), false),
				],
			});

			await user.click(screen.getByRole("button", { name: "Mark All Ready" }));

			expect(certificateActions.markAllReady).toHaveBeenCalledOnce();
		});

		it("cannot be clicked once every form is marked ready", () => {
			renderPageWith({ forms: [formWith(10, generated(), true)] });

			expect(
				screen.getByRole("button", { name: "Mark All Ready" })
			).toBeDisabled();
		});

		it("cannot be clicked while certificates are generating", () => {
			certificateActions.isGenerating = true;
			try {
				renderPageWith({ forms: [formWith(10, null, false)] });

				expect(
					screen.getByRole("button", { name: "Generate All (1)" })
				).toBeDisabled();
			} finally {
				certificateActions.isGenerating = false;
			}
		});

		it("waits for a drug bag before offering to generate", () => {
			renderPageWith({
				forms: [
					{ id: 10, bags: [], certificate: null } as unknown as Priority3Form,
				],
			});

			const action = screen.getByRole("button", { name: "Generate All" });
			expect(action).toBeDisabled();
			expect(action).toHaveAttribute(
				"title",
				"Add a drug bag to a form before generating certificates"
			);
		});

		it("is not offered once the case is finalised", () => {
			renderPageWith({
				forms: [
					{
						...formWith(10, generated(), true),
						phase: "batching",
					} as unknown as Priority3Form,
				],
			});

			expect(
				screen.queryByRole("button", { name: "Mark All Ready" })
			).not.toBeInTheDocument();
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
