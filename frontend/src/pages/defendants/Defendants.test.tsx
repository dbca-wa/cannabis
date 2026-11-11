import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { RecordUsage } from "@/shared/types/record-usage.types";

vi.mock("@/features/defendants/components/DefendantsTable", () => ({
	DefendantsTable: () => <div data-testid="defendants-table" />,
}));
vi.mock("@/features/defendants/components/DefendantsFilters", () => ({
	DefendantsFilters: () => <div data-testid="defendants-filters" />,
}));

// A stand-in picker that records which defendants it was told to hide.
const excluded: number[][] = [];
vi.mock("@/features/defendants/components/DefendantSearchCombobox", () => ({
	DefendantSearchCombobox: ({
		id,
		exclude,
		onValueChange,
	}: {
		id: string;
		exclude?: number[];
		onValueChange: (value: number | null) => void;
	}) => {
		excluded.push(exclude ?? []);
		return (
			<select
				id={id}
				defaultValue=""
				onChange={(e) =>
					onValueChange(e.target.value ? Number(e.target.value) : null)
				}
			>
				<option value="">Choose</option>
				<option value="12">Alex Brown</option>
			</select>
		);
	},
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ isAdmin: false }),
}));

const mutateAsync = vi.fn();
let usage: RecordUsage = { cases: [] };
vi.mock(
	"@/features/defendants/hooks/useDefendants",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("@/features/defendants/hooks/useDefendants")
		>()),
		useDefendantById: () => ({
			data: { id: 4, full_name: "Chris Green", cases_count: 1 },
			isLoading: false,
			error: null,
		}),
		useDefendantUsage: () => ({ data: usage, isLoading: false, error: null }),
		useDeleteDefendant: () => ({ mutateAsync, isPending: false }),
	})
);

const Defendants = await import("./Defendants").then((m) => m.default);
const { DeleteDefendantRouteModal } =
	await import("@/features/defendants/components/DeleteDefendantRouteModal");

const renderDelete = () =>
	renderPage(
		<Routes>
			<Route path="/defendants" element={<Defendants />}>
				<Route
					path=":defendantId/delete"
					element={<DeleteDefendantRouteModal />}
				/>
			</Route>
		</Routes>,
		{ initialEntries: ["/defendants/4/delete"] }
	);

describe("Defendants Page", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue(undefined);
		excluded.length = 0;
		usage = { cases: [] };
	});

	it("renders the header, filters, table, and actions", () => {
		renderPage(<Defendants />);

		expect(
			screen.getByRole("heading", { name: /defendants/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("defendants-filters")).toBeInTheDocument();
		expect(screen.getByTestId("defendants-table")).toBeInTheDocument();
		expect(screen.getByText("Add Defendant")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Defendants />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	it("moves a deleted defendant's cases to another defendant", async () => {
		const user = userEvent.setup();
		usage = {
			cases: [
				{
					id: 41,
					case_number: "IR 41",
					roles: ["defendant"],
					status: "assessment",
					status_display: "Assessment",
					is_complete: false,
				},
			],
		};
		renderDelete();

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText(/is used by 1 case/i)).toBeInTheDocument();
		// The defendant being deleted is not offered as its own replacement.
		expect(excluded.at(-1)).toEqual([4]);

		await user.selectOptions(
			within(dialog).getByLabelText(/replace with/i),
			"12"
		);
		await user.click(
			within(dialog).getByRole("button", { name: "Move 1 case and delete" })
		);

		expect(mutateAsync).toHaveBeenCalledWith({ id: 4, replacementId: 12 });
	});
});
