import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../services/drugBags.service", () => ({
	batchCreateDrugBags: vi.fn(),
}));
vi.mock("../services/cases.service", () => ({
	updateCase: vi.fn(),
}));
vi.mock("../services/ocr.service", () => ({
	uploadPoliceForm: vi.fn(),
}));

import { persistCaseExtras } from "./persistCaseExtras";
import { batchCreateDrugBags } from "../services/drugBags.service";
import { updateCase } from "../services/cases.service";
import { uploadPoliceForm } from "../services/ocr.service";
import type { DrugBagFormData } from "../stores/caseForm.store";

const bag = (overrides: Partial<DrugBagFormData> = {}): DrugBagFormData => ({
	content_type: "plant",
	seal_tag_numbers: "T100",
	new_seal_tag_numbers: "T100",
	property_reference: "",
	gross_weight: "",
	net_weight: "",
	determination: "cannabis_sativa",
	...overrides,
});

describe("persistCaseExtras", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("batch-creates bags, sets station, and uploads the form", async () => {
		const file = new File(["x"], "form.pdf", { type: "application/pdf" });
		vi.mocked(batchCreateDrugBags).mockResolvedValue([] as never);
		vi.mocked(updateCase).mockResolvedValue({} as never);
		vi.mocked(uploadPoliceForm).mockResolvedValue({ police_form_url: "u" });

		await persistCaseExtras(5, {
			bags: [bag()],
			stationId: 3,
			policeForm: file,
		});

		expect(batchCreateDrugBags).toHaveBeenCalledWith(5, {
			bags: [
				{
					seal_tag_numbers: "T100",
					new_seal_tag_numbers: "T100",
					content_type: "plant",
					determination: "cannabis_sativa",
				},
			],
		});
		expect(updateCase).toHaveBeenCalledWith(5, { station: 3 });
		expect(uploadPoliceForm).toHaveBeenCalledWith(5, file);
	});

	it("skips each step when its data is absent", async () => {
		await persistCaseExtras(5, { bags: [], policeForm: null });
		expect(batchCreateDrugBags).not.toHaveBeenCalled();
		expect(updateCase).not.toHaveBeenCalled();
		expect(uploadPoliceForm).not.toHaveBeenCalled();
	});

	it("omits a pending determination from the batch payload", async () => {
		vi.mocked(batchCreateDrugBags).mockResolvedValue([] as never);
		await persistCaseExtras(5, {
			bags: [bag({ determination: "pending" })],
			policeForm: null,
		});
		expect(batchCreateDrugBags).toHaveBeenCalledWith(5, {
			bags: [
				{
					seal_tag_numbers: "T100",
					new_seal_tag_numbers: "T100",
					content_type: "plant",
				},
			],
		});
	});

	it("is best-effort — a failing step does not throw", async () => {
		vi.mocked(batchCreateDrugBags).mockRejectedValue(new Error("boom"));
		vi.mocked(uploadPoliceForm).mockRejectedValue(new Error("boom"));
		const file = new File(["x"], "form.pdf", { type: "application/pdf" });

		await expect(
			persistCaseExtras(5, { bags: [bag()], policeForm: file })
		).resolves.toBeUndefined();
	});
});
