import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { RecordUsage } from "@/shared/types/record-usage.types";

vi.mock("@/features/police/components/stations/PoliceStationsTable", () => ({
	PoliceStationsTable: () => <div data-testid="stations-table" />,
}));
vi.mock("@/features/police/components/stations/StationsFilters", () => ({
	StationsFilters: () => <div data-testid="stations-filters" />,
}));

// A stand-in picker: the real one searches the API.
vi.mock("@/features/police/components/stations/StationSearchComboBox", () => ({
	StationSearchComboBox: ({
		id,
		onValueChange,
	}: {
		id: string;
		onValueChange: (value: number | null) => void;
	}) => (
		<select
			id={id}
			defaultValue=""
			onChange={(e) =>
				onValueChange(e.target.value ? Number(e.target.value) : null)
			}
		>
			<option value="">Choose</option>
			<option value="8">Broome</option>
		</select>
	),
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ isAdmin: false }),
}));

const mutateAsync = vi.fn();
let usage: RecordUsage = { cases: [], officers: [] };
vi.mock(
	"@/features/police/hooks/usePoliceStations",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("@/features/police/hooks/usePoliceStations")
		>()),
		useStation: () => ({
			data: { id: 3, name: "Perth", officer_count: 1 },
			isLoading: false,
			error: null,
		}),
		useStationUsage: () => ({ data: usage, isLoading: false, error: null }),
		useDeleteStation: () => ({ mutateAsync, isPending: false }),
	})
);

const Stations = await import("./Stations").then((m) => m.default);
const { DeleteStationRouteModal } =
	await import("@/features/police/components/stations/DeleteStationRouteModal");

const renderDelete = () =>
	renderPage(
		<Routes>
			<Route path="/stations" element={<Stations />}>
				<Route path=":stationId/delete" element={<DeleteStationRouteModal />} />
			</Route>
		</Routes>,
		{ initialEntries: ["/stations/3/delete"] }
	);

describe("Stations Page", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue(undefined);
		usage = { cases: [], officers: [] };
	});

	it("renders the header, filters, table, and actions", () => {
		renderPage(<Stations />);

		expect(
			screen.getByRole("heading", { name: /stations/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("stations-filters")).toBeInTheDocument();
		expect(screen.getByTestId("stations-table")).toBeInTheDocument();
		expect(screen.getByText("Add Station")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Stations />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	it("moves the cases and officers of a deleted station to the chosen one", async () => {
		const user = userEvent.setup();
		usage = {
			cases: [
				{
					id: 41,
					case_number: "IR 41",
					roles: ["station"],
					status: "assessment",
					status_display: "Assessment",
					is_complete: false,
				},
			],
			officers: [{ id: 7, full_name: "Sam Lee" }],
		};
		renderDelete();

		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText(/is used by 1 case and 1 officer/i)
		).toBeInTheDocument();
		expect(within(dialog).getByText("Sam Lee")).toBeInTheDocument();

		await user.selectOptions(
			within(dialog).getByLabelText(/replace with/i),
			"8"
		);
		await user.click(
			within(dialog).getByRole("button", {
				name: "Move 1 case and 1 officer and delete",
			})
		);

		expect(mutateAsync).toHaveBeenCalledWith({ id: 3, replacementId: 8 });
	});

	it("needs a replacement when only officers use the station", async () => {
		usage = { cases: [], officers: [{ id: 7, full_name: "Sam Lee" }] };
		renderDelete();

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByLabelText(/replace with/i)).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Move 1 officer and delete" })
		).toBeDisabled();
	});
});
