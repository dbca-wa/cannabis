import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage } from "@/test/page-test-utils";
import type { IPracticeBrief } from "../types/practice.types";

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ user: { practice_mode: true }, refetchUser: vi.fn() }),
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

// The session picked the first example, but the case on the page was made
// from the second.
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

vi.mock("@/features/cases/services/cases.service", () => ({
	getCaseById: vi.fn(async () => ({
		id: 5,
		case_number: "PRACTICE-BBB",
		derived_status: "assessment",
		forms: [],
		defendants_details: [],
	})),
	getCases: vi.fn(async () => ({ results: [] })),
}));
vi.mock("@/features/cases/services/forms.service", () => ({
	getCaseForms: vi.fn(async () => []),
}));
vi.mock("@/features/batches/services/batches.service", () => ({
	getBatches: vi.fn(async () => []),
}));

const { PracticeBriefSheet } = await import("./PracticeBriefSheet");
const { PracticeSheetProvider } = await import("./PracticeSheetContext");

describe("PracticeBriefSheet — on a practice case page", () => {
	beforeEach(() => {
		currentIndex = 0;
	});

	it("shows the brief the case was made from, without the example arrows", async () => {
		renderPage(
			<PracticeSheetProvider>
				<PracticeBriefSheet />
			</PracticeSheetProvider>,
			{ initialEntries: ["/cases/5"] }
		);

		expect(await screen.findByText("PRACTICE-BBB")).toBeInTheDocument();
		expect(screen.queryByText("PRACTICE-AAA")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /next example/i })
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/restart this practice case below/i)
		).toBeInTheDocument();
		expect(currentIndex).toBe(1);
	});

	it("says the practice is complete once the invoice is recorded", async () => {
		const cases = await import("@/features/cases/services/cases.service");
		const batches = await import("@/features/batches/services/batches.service");
		vi.mocked(cases.getCaseById).mockResolvedValueOnce({
			id: 5,
			case_number: "PRACTICE-BBB",
			derived_status: "complete",
			forms: [],
			defendants_details: [],
		} as never);
		vi.mocked(batches.getBatches).mockResolvedValue([
			{ case_numbers: ["PRACTICE-BBB"], is_invoiced: true },
		] as never);

		renderPage(
			<PracticeSheetProvider>
				<PracticeBriefSheet />
			</PracticeSheetProvider>,
			{ initialEntries: ["/cases/5"] }
		);

		expect(await screen.findByText(/practice complete/i)).toBeInTheDocument();
	});
});
