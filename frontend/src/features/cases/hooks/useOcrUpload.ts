import { useMutation } from "@tanstack/react-query";
import { uploadAndExtract } from "../services/ocr.service";
import { ocrResultStore } from "../stores/ocrResult.store";
import { prefillCaseForm } from "../utils/prefillCaseForm";
import { useCaseFormStore } from "./useCaseFormStore";
import type { ApiError } from "@/shared/services/api/client.service";

/**
 * TanStack mutation hook for uploading a police form scan
 * and prefilling the case form with extracted data.
 */
export const useOcrUpload = () => {
	const formStore = useCaseFormStore();

	return useMutation({
		mutationFn: (file: File) => {
			ocrResultStore.setProcessing(true);
			ocrResultStore.uploadedFileName = file.name;
			return uploadAndExtract(file);
		},
		onSuccess: (data) => {
			ocrResultStore.setResult(data);
			console.log("[OCR] Prefilling form with extraction data:", {
				items: data.extraction.items.length,
				date: data.extraction.date.value,
				matches: Object.fromEntries(
					Object.entries(data.matches).map(([k, v]) => [
						k,
						(v as { candidates: unknown[] }).candidates.length,
					])
				),
			});
			prefillCaseForm(data, formStore, ocrResultStore);
		},
		onError: (error: ApiError) => {
			ocrResultStore.setError(
				error.message || "Failed to process the uploaded file."
			);
		},
	});
};
