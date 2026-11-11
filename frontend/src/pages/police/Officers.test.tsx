import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { RecordUsage } from "@/shared/types/record-usage.types";

vi.mock("@/features/police/components/officers/PoliceOfficersTable", () => ({
	PoliceOfficersTable: () => <div data-testid="officers-table" />,
}));

// A stand-in picker: the real one searches the API.
vi.mock("@/features/police/components/officers/OfficerSearchComboBox", () => ({
	OfficerSearchComboBox: ({
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
			<option value="5">Jane Smith</option>
			<option value="9">Sam Lee</option>
		</select>
	),
}));

const authState = { isAdmin: false };
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

const mutateAsync = vi.fn();
let usage: RecordUsage = { cases: [] };
vi.mock(
	"@/features/police/hooks/usePoliceOfficers",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("@/features/police/hooks/usePoliceOfficers")
		>()),
		usePoliceOfficer: () => ({
			data: { id: 5, full_name: "Jane Smith", badge_number: "123" },
			isLoading: false,
			error: null,
		}),
		useOfficerUsage: () => ({ data: usage, isLoading: false, error: null }),
		useDeletePoliceOfficer: () => ({ mutateAsync, isPending: false }),
	})
);

const Officers = await import("./Officers").then((m) => m.default);
const { DeleteOfficerRouteModal } =
	await import("@/features/police/components/officers/DeleteOfficerRouteModal");

const renderDelete = () =>
	renderPage(
		<Routes>
			<Route path="/officers" element={<Officers />}>
				<Route path=":officerId/delete" element={<DeleteOfficerRouteModal />} />
			</Route>
		</Routes>,
		{ initialEntries: ["/officers/5/delete"] }
	);

const caseOn = (id: number, complete = false) => ({
	id,
	case_number: `IR ${id}`,
	roles: ["conveying"],
	status: complete ? "complete" : "assessment",
	status_display: complete ? "Complete" : "Assessment",
	is_complete: complete,
});

describe("Officers Page", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue(undefined);
		authState.isAdmin = false;
		usage = { cases: [] };
	});

	it("renders the header, table, and merge/add actions", () => {
		renderPage(<Officers />);

		expect(
			screen.getByRole("heading", { name: /officers/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByTestId("officers-table")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /merge/i })).toBeInTheDocument();
		expect(screen.getByText("Add Officer")).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Officers />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	describe("deleting an officer", () => {
		it("deletes an officer no case uses without asking for a replacement", async () => {
			const user = userEvent.setup();
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			expect(within(dialog).getByText(/no cases use/i)).toBeInTheDocument();
			expect(within(dialog).queryByLabelText(/replace with/i)).toBeNull();

			await user.click(
				within(dialog).getByRole("button", { name: "Delete officer" })
			);
			expect(mutateAsync).toHaveBeenCalledWith({ id: 5, replacementId: null });
		});

		it("lists the affected cases and moves them to the chosen officer", async () => {
			const user = userEvent.setup();
			usage = {
				cases: [
					caseOn(41),
					{ ...caseOn(42), roles: ["conveying", "requesting"] },
				],
			};
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			expect(
				within(dialog).getByText(/is used by 2 cases/i)
			).toBeInTheDocument();
			expect(
				within(dialog).getByRole("link", { name: /IR 41/ })
			).toHaveAttribute("href", "/cases/41");
			expect(
				within(dialog).getByText(/conveying officer and requesting officer/i)
			).toBeInTheDocument();

			const confirm = within(dialog).getByRole("button", {
				name: "Move 2 cases and delete",
			});
			expect(confirm).toBeDisabled();

			await user.selectOptions(
				within(dialog).getByLabelText(/replace with/i),
				"9"
			);
			expect(confirm).toBeEnabled();
			await user.click(confirm);

			expect(mutateAsync).toHaveBeenCalledWith({ id: 5, replacementId: 9 });
		});

		it("refuses the officer being deleted as its own replacement", async () => {
			const user = userEvent.setup();
			usage = { cases: [caseOn(41)] };
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			await user.selectOptions(
				within(dialog).getByLabelText(/replace with/i),
				"5"
			);

			expect(
				within(dialog).getByText(/choose a different officer/i)
			).toBeInTheDocument();
			expect(
				within(dialog).getByRole("button", { name: "Move 1 case and delete" })
			).toBeDisabled();
		});

		it("leaves complete cases to an administrator", async () => {
			usage = { cases: [caseOn(41, true)] };
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			expect(
				within(dialog).getByText(/only an administrator can move them/i)
			).toBeInTheDocument();
			expect(within(dialog).queryByLabelText(/replace with/i)).toBeNull();
			expect(
				within(dialog).getByRole("button", { name: "Move 1 case and delete" })
			).toBeDisabled();
		});

		it("lets an administrator move complete cases", async () => {
			authState.isAdmin = true;
			usage = { cases: [caseOn(41, true)] };
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			expect(
				within(dialog).getByLabelText(/replace with/i)
			).toBeInTheDocument();
		});

		it("has no accessibility violations", async () => {
			usage = { cases: [caseOn(41)] };
			renderDelete();

			const dialog = await screen.findByRole("dialog");
			const results = await testAccessibility(dialog);
			expect(results).toHaveNoViolations();
		});
	});
});
