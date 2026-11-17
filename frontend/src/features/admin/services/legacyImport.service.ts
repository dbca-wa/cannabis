import { apiClient } from "@/shared/services/api";
import { LEGACY_IMPORT_ENDPOINTS } from "./legacyImport.endpoints";
import type {
	LegacyImportAction,
	LegacyImportBundle,
	LegacyImportRun,
} from "../types/legacyImport.types";

export const getLegacyImportBundle =
	async (): Promise<LegacyImportBundle | null> =>
		(
			await apiClient.get<{ bundle: LegacyImportBundle | null }>(
				LEGACY_IMPORT_ENDPOINTS.BUNDLE()
			)
		).bundle;

/** Upload the bundle; the server validates it before keeping it. */
export const uploadLegacyImportBundle = async (
	file: File
): Promise<LegacyImportBundle> => {
	const formData = new FormData();
	formData.append("file", file);
	const response = await apiClient.post<{ bundle: LegacyImportBundle }>(
		LEGACY_IMPORT_ENDPOINTS.BUNDLE(),
		formData,
		{ headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 }
	);
	return response.bundle;
};

export const deleteLegacyImportBundle = async (): Promise<void> => {
	await apiClient.delete(LEGACY_IMPORT_ENDPOINTS.BUNDLE());
};

export const getLegacyImportRuns = async (): Promise<LegacyImportRun[]> =>
	(
		await apiClient.get<{ runs: LegacyImportRun[] }>(
			LEGACY_IMPORT_ENDPOINTS.RUNS()
		)
	).runs;

export const startLegacyImportRun = async (
	action: LegacyImportAction
): Promise<LegacyImportRun> =>
	(
		await apiClient.post<{ run: LegacyImportRun }>(
			LEGACY_IMPORT_ENDPOINTS.RUNS(),
			{
				action,
			}
		)
	).run;
