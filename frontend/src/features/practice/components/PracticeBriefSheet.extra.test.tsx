import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "@/test/page-test-utils";
import type { IPracticeBrief } from "../types/practice.types";

const authState = { user: { practice_mode: true } as Record<string, unknown> };
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: authState.user, refetchUser: vi.fn() }),
}));

const makeBrief = (ref: string, officerLast: string): IPracticeBrief => ({
	label: ref,
	case_number: ref,
	officer: {
		rank_display: "Sergeant",
		badge_number: "PD1",
		given_names: "Sam",
		last_name: officerLast,
		station: "Fremantle",
	},
	station: "Fremantle",
	defendant: { given_names: "Chris", last_name: "Nguyen" },
	forms: [{ security_movement_envelope: "", bags: [] }],
});

const briefs = [
	makeBrief("PRACTICE-AAA", "Turner"),
	makeBrief("PRACTICE-BBB", "Patel"),
];

let currentIndex = 0;
vi.mock("@/features/practice/data/practiceBriefs", () => ({
	get PRACTICE_BRIEFS() {
		return briefs;
	},
	getPracticeBriefIndex: () => currentIndex,
	setPracticeBriefIndex: (i: number) => {
		currentIndex = i;
	},
	getSessionPracticeBrief: () => briefs[currentIndex],
}));

const { PracticeBriefSheet } = await import("./PracticeBriefSheet");
const { PracticeSheetProvider } = await import("./PracticeSheetContext");
const { usePracticeSheet } = await import("./practiceSheet.context");

describe("PracticeBriefSheet — example navigation", () => {
	beforeEach(() => {
		currentIndex = 0;
	});

	it("pages between examples with the arrows", async () => {
		const user = userEvent.setup();
		renderPage(
			<PracticeSheetProvider>
				<PracticeBriefSheet />
			</PracticeSheetProvider>,
			{ initialEntries: ["/cases/add"] }
		);

		expect(await screen.findByText("PRACTICE-AAA")).toBeInTheDocument();
		expect(screen.getByText("1/2")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /next example/i }));

		expect(await screen.findByText("PRACTICE-BBB")).toBeInTheDocument();
		expect(screen.getByText("2/2")).toBeInTheDocument();
	});
});

describe("PracticeBriefSheet — ticks off live create data", () => {
	beforeEach(() => {
		currentIndex = 0;
	});

	it("marks the police reference done once it matches the brief", async () => {
		// A helper that pushes live create-form values into the sheet context.
		const Feeder = ({ caseNumber }: { caseNumber: string }) => {
			const { setLiveCreateData } = usePracticeSheet();
			return (
				<button
					type="button"
					onClick={() =>
						setLiveCreateData({
							case_number: caseNumber,
							defendant_names: [],
						})
					}
				>
					feed
				</button>
			);
		};

		const user = userEvent.setup();
		renderPage(
			<PracticeSheetProvider>
				<Feeder caseNumber="PRACTICE-AAA" />
				<PracticeBriefSheet />
			</PracticeSheetProvider>,
			{ initialEntries: ["/cases/add"] }
		);

		// Before feeding, the reference item is not crossed out.
		const refItem = (await screen.findByText("PRACTICE-AAA")).closest("li");
		expect(refItem?.querySelector(".line-through")).toBeNull();

		await user.click(screen.getByRole("button", { name: "feed" }));

		// After feeding the matching reference, the item is struck through (done).
		const refItemAfter = screen.getAllByText("PRACTICE-AAA")[0].closest("li");
		expect(refItemAfter?.textContent).toContain("Police reference");
		expect(refItemAfter?.querySelector("span.line-through")).not.toBeNull();
	});
});
