import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage } from "@/test/page-test-utils";

const authState: { user: Record<string, unknown> | null } = { user: null };

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: authState.user, refetchUser: vi.fn() }),
}));

const briefMock = vi.fn();
vi.mock("@/features/practice/services/practice.service", () => ({
	enablePracticeMode: vi.fn(),
	disablePracticeMode: vi.fn(),
	getPracticeBrief: () => briefMock(),
}));

const { PracticeModeBanner } = await import("./PracticeModeBanner");
const { PracticeBriefPanel } = await import("./PracticeBriefPanel");
const { PracticeCoachmark } = await import("./PracticeCoachmark");

const brief = {
	case_number: "PRACTICE-123456",
	officer: {
		rank: "sergeant",
		rank_display: "Sergeant",
		badge_number: "PD51021",
		given_names: "Alex",
		last_name: "Turner",
		station: "Fremantle",
	},
	station: "Fremantle",
	defendant: { given_names: "Chris", last_name: "Nguyen" },
	botanist: { given_names: "Sam", last_name: "Patel" },
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
};

describe("Practice mode UI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		briefMock.mockResolvedValue(brief);
	});

	describe("PracticeModeBanner", () => {
		it("renders nothing when the user is not in practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(<PracticeModeBanner />);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows the banner and a leave button when practice mode is on", () => {
			authState.user = {
				practice_mode: true,
				practice_mode_expires_at: "2026-10-02T09:00:00Z",
			};
			renderPage(<PracticeModeBanner />);
			expect(screen.getByText(/nothing here is real/i)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /leave practice mode/i })
			).toBeInTheDocument();
		});
	});

	describe("PracticeBriefPanel", () => {
		it("renders nothing when not in practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(<PracticeBriefPanel />);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows the brief details when in practice mode", async () => {
			authState.user = { practice_mode: true };
			renderPage(<PracticeBriefPanel />);
			expect(await screen.findByText("PRACTICE-123456")).toBeInTheDocument();
			expect(screen.getByText(/T01234/)).toBeInTheDocument();
			expect(screen.getByText(/SME1234/)).toBeInTheDocument();
		});
	});

	describe("PracticeCoachmark", () => {
		it("hides outside practice mode", () => {
			authState.user = { practice_mode: false };
			const { container } = renderPage(
				<PracticeCoachmark id="t1" title="Hint">
					body
				</PracticeCoachmark>
			);
			expect(container).toBeEmptyDOMElement();
		});

		it("shows guidance in practice mode", () => {
			authState.user = { practice_mode: true };
			renderPage(
				<PracticeCoachmark id="t2" title="Do this">
					helpful body
				</PracticeCoachmark>
			);
			expect(screen.getByText("Do this")).toBeInTheDocument();
			expect(screen.getByText("helpful body")).toBeInTheDocument();
		});
	});
});
