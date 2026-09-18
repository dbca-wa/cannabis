import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const deleteCase = vi.fn();

const caseState: { data: unknown; isLoading: boolean; error: unknown } = {
	data: null,
	isLoading: false,
	error: null,
};

vi.mock("../../hooks/useCases", () => ({
	useCases: () => ({ deleteCase, isDeleting: false }),
	useCaseById: () => caseState,
}));

vi.mock("react-router", async () => {
	const actual =
		await vi.importActual<typeof import("react-router")>("react-router");
	return {
		...actual,
		useNavigate: () => vi.fn(),
		useParams: () => ({ id: "1" }),
	};
});

const { DeleteCaseRouteModal } = await import("./DeleteCaseRouteModal");

/** A case with no batched certificates, so it can be deleted. */
const deletableCase = () => ({
	id: 1,
	case_number: "IR 123456789",
	received: "2026-03-20T09:00:00Z",
	derived_status: "assessment",
	derived_status_display: "Assessment",
	bags_count: 2,
	forms: [
		{
			id: 10,
			certificate: { id: 5, certificate_number: "R000001", batch_id: null },
		},
	],
});

/** A case whose certificate belongs to a batch, so it must be refused. */
const batchedCase = () => ({
	...deletableCase(),
	forms: [
		{
			id: 10,
			certificate: { id: 5, certificate_number: "R000001", batch_id: 3 },
		},
	],
});

describe("DeleteCaseRouteModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		caseState.data = deletableCase();
		caseState.isLoading = false;
		caseState.error = null;
	});

	describe("typed confirmation", () => {
		it("starts with the delete button disabled", () => {
			renderPage(<DeleteCaseRouteModal />);

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeDisabled();
		});

		it("stays disabled while the wrong word is typed", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "remove");

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeDisabled();
		});

		it("stays disabled on a partial match", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "del");

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeDisabled();
		});

		it("enables the button once delete is typed", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "delete");

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeEnabled();
		});

		it("accepts a different letter case", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "DELETE");

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeEnabled();
		});

		it("ignores surrounding whitespace", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "  delete  ");

			expect(
				screen.getByRole("button", { name: /delete case/i })
			).toBeEnabled();
		});

		it("only deletes after the confirmation is typed", async () => {
			const user = userEvent.setup();
			renderPage(<DeleteCaseRouteModal />);

			await user.type(screen.getByLabelText(/type.*to confirm/i), "delete");
			await user.click(screen.getByRole("button", { name: /delete case/i }));

			expect(deleteCase).toHaveBeenCalledOnce();
		});
	});

	describe("consequences", () => {
		it("states what will be removed", () => {
			renderPage(<DeleteCaseRouteModal />);

			expect(
				screen.getByText(/will be permanently removed/i)
			).toBeInTheDocument();
			expect(
				screen.getByText(/all of its priority 3 forms/i)
			).toBeInTheDocument();
			expect(
				screen.getByText(/all drug bags and their assessments/i)
			).toBeInTheDocument();
			expect(
				screen.getByText(/any generated certificates/i)
			).toBeInTheDocument();
		});

		it("states what will be kept", () => {
			renderPage(<DeleteCaseRouteModal />);

			expect(screen.getByText(/will be kept/i)).toBeInTheDocument();
			expect(screen.getByText(/police officers/i)).toBeInTheDocument();
			expect(screen.getByText(/police stations/i)).toBeInTheDocument();
			expect(screen.getByText(/defendants/i)).toBeInTheDocument();
		});
	});

	describe("batched cases", () => {
		it("refuses deletion and names the certificate", () => {
			caseState.data = batchedCase();
			renderPage(<DeleteCaseRouteModal />);

			expect(screen.getByText(/cannot delete case/i)).toBeInTheDocument();
			expect(screen.getByText(/R000001/)).toBeInTheDocument();
		});

		it("offers no delete button or confirmation field", () => {
			caseState.data = batchedCase();
			renderPage(<DeleteCaseRouteModal />);

			expect(
				screen.queryByRole("button", { name: /delete case/i })
			).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(/type.*to confirm/i)
			).not.toBeInTheDocument();
		});
	});

	it("has no accessibility violations", async () => {
		const { baseElement } = renderPage(<DeleteCaseRouteModal />);

		const results = await testAccessibility(baseElement);
		expect(results).toHaveNoViolations();
	});
});
