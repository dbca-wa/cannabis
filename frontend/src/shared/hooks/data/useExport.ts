import { useState, useCallback } from "react";
import {
	ExportService,
	type ExportConfig,
} from "@/shared/services/export.service";

export interface UseExportOptions {
	entityName: string;
	exportEndpoint: string;
	getCurrentFilters: () => {
		searchQuery?: string;
		ordering?: string;
		additionalParams?: Record<string, string | number | boolean>;
	};
}

export function useExport(options: UseExportOptions) {
	const [isExporting, setIsExporting] = useState(false);

	const exportData = useCallback(
		async (format: "csv" | "json") => {
			const filters = options.getCurrentFilters();

			const config: ExportConfig = {
				entityName: options.entityName,
				exportEndpoint: options.exportEndpoint,
				searchQuery: filters.searchQuery,
				ordering: filters.ordering,
				additionalParams: filters.additionalParams,
			};

			await ExportService.exportAndDownload(
				format,
				config,
				() => setIsExporting(true),
				() => setIsExporting(false)
			);
		},
		[options]
	);

	const exportCSV = useCallback(() => exportData("csv"), [exportData]);
	const exportJSON = useCallback(() => exportData("json"), [exportData]);

	return {
		isExporting,
		exportCSV,
		exportJSON,
		exportData,
	};
}
