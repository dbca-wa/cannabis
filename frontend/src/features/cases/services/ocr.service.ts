import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import type { OcrExtractionResponse } from "../types/ocr.types";

/** Upload a police form scan and receive structured extraction results. */
export const uploadAndExtract = async (
	file: File
): Promise<OcrExtractionResponse> => {
	const formData = new FormData();
	formData.append("file", file);

	return apiClient.post<OcrExtractionResponse>(
		ENDPOINTS.CASES.OCR_UPLOAD,
		formData,
		{
			headers: { "Content-Type": "multipart/form-data" },
			timeout: 30_000,
		}
	);
};
