import { batchCreateDrugBags } from "../services/drugBags.service";
import { updateCase } from "../services/cases.service";
import { uploadPoliceForm } from "../services/ocr.service";
import { logger } from "@/shared/services/logger.service";
import type { DrugBagFormData } from "../stores/caseForm.store";

interface CaseExtras {
	bags: DrugBagFormData[];
	stationId?: number;
	policeForm: File | null;
}

/**
 * Persist data the case-create serializer does not accept: OCR-prefilled drug
 * bags, the selected station, and the scanned police form. Each step is
 * best-effort — a failure is logged but never blocks case creation, which has
 * already succeeded by the time this runs.
 */
export const persistCaseExtras = async (
	caseId: number,
	{ bags, stationId, policeForm }: CaseExtras
): Promise<void> => {
	// Drug bags (from OCR extraction)
	if (bags.length > 0) {
		try {
			await batchCreateDrugBags(caseId, {
				bags: bags.map((bag) => ({
					seal_tag_numbers: bag.seal_tag_numbers,
					new_seal_tag_numbers: bag.new_seal_tag_numbers || "",
					content_type: bag.content_type,
					...(bag.determination && bag.determination !== "pending"
						? { determination: bag.determination }
						: {}),
				})),
			});
		} catch (error) {
			logger.error("Failed to persist OCR-extracted bags", { error, caseId });
		}
	}

	// Station (the create serializer omits it)
	if (stationId) {
		try {
			await updateCase(caseId, { station: stationId });
		} catch (error) {
			logger.error("Failed to set station on new case", { error, caseId });
		}
	}

	// Scanned Priority 3 form (optional reference copy)
	if (policeForm) {
		try {
			await uploadPoliceForm(caseId, policeForm);
		} catch (error) {
			logger.error("Failed to store police form", { error, caseId });
		}
	}
};
