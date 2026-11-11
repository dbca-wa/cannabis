import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { Batch } from "@/features/batches/types/batches.types";

const mutationStub = () => ({ mutateAsync: vi.fn(), isPending: false });

const state: { batches: Batch[] } = { batches: [] };
const recordInvoice = vi.fn();

vi.mock("@/features/batches", () => ({
	useBatches: () => ({ data: state.batches, isLoading: false }),
	useDeleteBatch: mutationStub,
	useRecordInvoiceRaised: () => ({
		mutateAsync: recordInvoice,
		isPending: false,
	}),
	useUnsetInvoiceRaised: mutationStub,
	useRepackageBatch: mutationStub,
	downloadBatchZip: vi.fn(),
	getBatchExportUrl: () => "/api/v1/batches/export",
}));

vi.mock("@/features/police/hooks/useOfficerById", () => ({
	useOfficerById: () => ({ data: null }),
}));

vi.mock("@/shared/components/police", () => ({
	OfficerSearchComboBox: () => <div data-testid="officer-search" />,
}));

const Batches = await import("./Batches").then((m) => m.default);

const makeBatch = (overrides: Partial<Batch> = {}): Batch => ({
	id: 1,
	batch_number: "BATCH042",
	// The 25th cannot be read as a month, so day-first and month-first
	// renderings are distinguishable.
	date_batched: "2026-11-25T02:00:00Z",
	certificate_count: 1,
	bag_count: 3,
	cert_rate: "110.00",
	bag_rate: "11.00",
	tax_percentage: "10.00",
	cert_cost: "110.00",
	bag_cost: "33.00",
	subtotal: "143.00",
	tax_amount: "14.30",
	total: "157.30",
	certificate_number_range: "R000001",
	certificate_numbers: ["R000001"],
	invoice_raised_number: null,
	invoice_raised_at: null,
	is_invoiced: false,
	botanists: ["John Huisman"],
	submitting_officers: ["Alex Turner"],
	case_numbers: ["IR123"],
	out_of_date_certificates: [],
	created_at: "2026-11-25T02:00:00Z",
	...overrides,
});

describe("Batches Page", () => {
	beforeEach(() => {
		state.batches = [];
	});

	it("renders the header and empty state", () => {
		renderPage(<Batches />);

		expect(
			screen.getByRole("heading", { name: /batches/i, level: 1 })
		).toBeInTheDocument();
		expect(
			screen.getByText(/no batches yet\. create one from the cases page/i)
		).toBeInTheDocument();
	});

	it("shows the batch date day first, as the rest of the app does", () => {
		state.batches = [makeBatch()];
		renderPage(<Batches />);

		expect(screen.getByText("25/11/2026")).toBeInTheDocument();
		expect(screen.queryByText("11/25/2026")).not.toBeInTheDocument();
	});

	it("opens a batch from the keyboard", async () => {
		state.batches = [makeBatch()];
		const user = userEvent.setup();
		renderPage(<Batches />);

		const open = screen.getByRole("button", { name: "BATCH042" });
		open.focus();
		await user.keyboard("{Enter}");

		expect(
			await screen.findByRole("dialog", { name: "BATCH042" })
		).toBeInTheDocument();
	});

	it("records the invoice number when Enter is pressed in the box", async () => {
		state.batches = [makeBatch()];
		recordInvoice.mockResolvedValue({});
		const user = userEvent.setup();
		renderPage(<Batches />);

		await user.click(
			screen.getByRole("button", { name: /record invoice for batch042/i })
		);
		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveTextContent("BATCH042");
		await user.type(
			screen.getByRole("textbox", { name: /invoice-raised number/i }),
			"6062{Enter}"
		);

		expect(recordInvoice).toHaveBeenCalledWith({
			invoice_raised_number: "6062",
		});
	});

	it("flags a batch whose certificates changed after packaging", async () => {
		state.batches = [
			makeBatch({ out_of_date_certificates: ["R000001"] }),
			makeBatch({ id: 2, batch_number: "BATCH043" }),
		];
		const user = userEvent.setup();
		renderPage(<Batches />);

		expect(screen.getAllByText("Needs re-package")).toHaveLength(1);

		await user.click(screen.getByRole("button", { name: "BATCH042" }));
		const dialog = await screen.findByRole("dialog", { name: "BATCH042" });
		expect(dialog).toHaveTextContent(
			"Certificate R000001 has changed since this batch was packaged"
		);
	});

	it("does not flag a batch that is up to date", async () => {
		state.batches = [makeBatch()];
		const user = userEvent.setup();
		renderPage(<Batches />);

		expect(screen.queryByText("Needs re-package")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "BATCH042" }));
		const dialog = await screen.findByRole("dialog", { name: "BATCH042" });
		expect(dialog).not.toHaveTextContent(/changed since this batch/i);
	});

	it("names each batch's actions menu", () => {
		state.batches = [makeBatch()];
		renderPage(<Batches />);

		expect(
			screen.getByRole("button", { name: "Actions for BATCH042" })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Batches />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	it("has no accessibility violations with a batch listed", async () => {
		state.batches = [makeBatch()];
		const { container } = renderPage(<Batches />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
