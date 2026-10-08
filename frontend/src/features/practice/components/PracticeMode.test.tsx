import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "@/test/page-test-utils";

const authState: { user: Record<string, unknown> | null } = { user: null };

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: authState.user, refetchUser: vi.fn() }),
}));

// The brief is hardcoded; mock the session picker to a known example.
const brief = {
	label: "Test brief",
	case_number: "PRACTICE-123456",
	officer: {
		rank_display: "Sergeant",
		badge_number: "PD51021",
		given_names: "Alex",
		last_name: "Turner",
		station: "Fremantle",
	},
	station: "Fremantle",
	defendant: { given_names: "Chris", last_name: "Nguyen" },
	forms: [
		{
			security_movement_envelope: "SME1234",
			bags: [
				{
					original_seal: "T01234",
					new_seal: "N01234",
					content_type: "plant_material",
					determination: "cannabis_sativa",
					female_plants: true,
				},
			],
		},
	],
};

vi.mock("@/features/practice/data/practiceBriefs", () => ({
	PRACTICE_BRIEFS: [brief],
	getSessionPracticeBrief: () => brief,
	getPracticeBriefIndex: () => 0,
	setPracticeBriefIndex: () => {},
}));

const { PracticeModeBanner } = await import("./PracticeModeBanner");
const { PracticeBriefSheet } = await import("./PracticeBriefSheet");
const { PracticeActionPrompt } = await import("./PracticeActionPrompt");
const { PracticeSheetProvider } = await import("./PracticeSheetContext");
const { usePracticeSheet } = await import("./practiceSheet.context");

describe("Practice mode UI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// The guide-on preference persists to localStorage; clear it so one test's
		// toggle does not leak into the next.
		try {
			localStorage.clear();
		} catch {
			/* no localStorage in this environment */
		}
	});

	describe("PracticeModeBanner", () => {
		it("renders nothing when the user is not in practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(<PracticeModeBanner />);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows the banner, a leave button and a reset button in practice mode", () => {
			authState.user = {
				practice_mode: true,
				practice_mode_started_at: "2026-10-02T09:00:00Z",
			};
			renderPage(<PracticeModeBanner />);
			expect(screen.getByText(/nothing here is real/i)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /leave practice mode/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /reset practice data/i })
			).toBeInTheDocument();
		});
	});

	describe("PracticeBriefSheet", () => {
		it("renders nothing when not in practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(
				<PracticeSheetProvider>
					<PracticeBriefSheet />
				</PracticeSheetProvider>
			);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows the brief checklist and route guidance when in practice mode", async () => {
			authState.user = { practice_mode: true };
			renderPage(
				<PracticeSheetProvider>
					<PracticeBriefSheet />
				</PracticeSheetProvider>,
				{ initialEntries: ["/cases/add"] }
			);
			// Brief details as checklist items.
			expect(await screen.findByText("PRACTICE-123456")).toBeInTheDocument();
			expect(screen.getByText(/original T01234/)).toBeInTheDocument();
			expect(screen.getByText("SME1234")).toBeInTheDocument();
			// Botanist is the default — the guide says so rather than naming one.
			expect(screen.getByText(/use the default/i)).toBeInTheDocument();
			// Route-aware guidance for the case-creation page.
			expect(screen.getByText(/Step 1 — Create the case/i)).toBeInTheDocument();
		});

		it("gives batching guidance on the Batches page", async () => {
			authState.user = { practice_mode: true };
			renderPage(
				<PracticeSheetProvider>
					<PracticeBriefSheet />
				</PracticeSheetProvider>,
				{ initialEntries: ["/batches"] }
			);
			expect(
				await screen.findByText(/Step 5 — Batch and complete the case/i)
			).toBeInTheDocument();
		});

		it("can be hidden with the close button", async () => {
			const user = userEvent.setup();
			authState.user = { practice_mode: true };
			renderPage(
				<PracticeSheetProvider>
					<PracticeBriefSheet />
				</PracticeSheetProvider>
			);
			await screen.findByText("PRACTICE-123456");
			await user.click(
				screen.getByRole("button", { name: /hide practice guide/i })
			);
			expect(screen.queryByText("PRACTICE-123456")).not.toBeInTheDocument();
		});
	});

	describe("PracticeBriefSheet — guide-only reference mode", () => {
		// Turns the reference guide on from inside the provider.
		const GuideEnabler = () => {
			const { setGuideEnabled } = usePracticeSheet();
			return (
				<button type="button" onClick={() => setGuideEnabled(true)}>
					enable-guide
				</button>
			);
		};

		it("stays hidden outside practice mode until the guide is enabled", async () => {
			const user = userEvent.setup();
			authState.user = { practice_mode: false };
			renderPage(
				<PracticeSheetProvider>
					<GuideEnabler />
					<PracticeBriefSheet />
				</PracticeSheetProvider>,
				{ initialEntries: ["/cases"] }
			);
			// Nothing from the sheet yet.
			expect(screen.queryByLabelText("Case guide")).not.toBeInTheDocument();

			await user.click(screen.getByRole("button", { name: "enable-guide" }));

			// The reference sheet appears with instructions, and no practice data.
			expect(await screen.findByLabelText("Case guide")).toBeInTheDocument();
			expect(screen.getByText(/Step 1 — Create the case/i)).toBeInTheDocument();
			expect(screen.queryByText("PRACTICE-123456")).not.toBeInTheDocument();
			expect(screen.queryByText(/Fake data/i)).not.toBeInTheDocument();
		});

		it("lets the user jump to another step by clicking it", async () => {
			const user = userEvent.setup();
			authState.user = { practice_mode: false };
			renderPage(
				<PracticeSheetProvider>
					<GuideEnabler />
					<PracticeBriefSheet />
				</PracticeSheetProvider>,
				{ initialEntries: ["/cases"] }
			);
			await user.click(screen.getByRole("button", { name: "enable-guide" }));
			await screen.findByLabelText("Case guide");

			await user.click(
				screen.getByRole("button", { name: /Batch and complete/i })
			);
			expect(
				screen.getByText(/Step 5 — Batch and complete the case/i)
			).toBeInTheDocument();
		});
	});

	describe("PracticeActionPrompt", () => {
		it("hides outside practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(
				<PracticeSheetProvider>
					<PracticeActionPrompt message="Start here" />
				</PracticeSheetProvider>
			);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows the nudge in practice mode", () => {
			authState.user = { practice_mode: true };
			renderPage(
				<PracticeSheetProvider>
					<PracticeActionPrompt message="Start here — create your practice case" />
				</PracticeSheetProvider>
			);
			expect(
				screen.getByText(/start here — create your practice case/i)
			).toBeInTheDocument();
		});

		it("opens the sheet when clicked", async () => {
			const user = userEvent.setup();
			authState.user = { practice_mode: true };

			// A probe that reports the sheet's open state, closed to start.
			const Probe = () => {
				const { isOpen } = usePracticeSheet();
				return <span>sheet:{isOpen ? "open" : "closed"}</span>;
			};
			const Closer = () => {
				const { close } = usePracticeSheet();
				return (
					<button type="button" onClick={close}>
						closeit
					</button>
				);
			};

			renderPage(
				<PracticeSheetProvider>
					<Closer />
					<Probe />
					<PracticeActionPrompt message="Start here" />
				</PracticeSheetProvider>
			);

			await user.click(screen.getByRole("button", { name: "closeit" }));
			expect(screen.getByText("sheet:closed")).toBeInTheDocument();

			await user.click(screen.getByRole("button", { name: /start here/i }));
			expect(screen.getByText("sheet:open")).toBeInTheDocument();
		});
	});
});
