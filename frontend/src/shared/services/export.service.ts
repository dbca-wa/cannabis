import { apiClient } from "@/shared/services/api";
import { generateFilename } from "@/shared/utils/export.utils";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";

export interface ExportConfig {
	entityName: string;
	exportEndpoint: string;
	searchQuery?: string;
	ordering?: string;
	additionalParams?: Record<string, string | number | boolean>;
}

export class ExportService {
	/**
	 * Export data in the specified format
	 */
	static async exportData(
		format: "csv" | "json",
		config: ExportConfig
	): Promise<Blob> {
		const searchParams = new URLSearchParams();

		// Add export_format parameter (avoid DRF format suffix conflicts)
		searchParams.append("export_format", format);

		// Add filtering parameters (but not pagination)
		if (config.searchQuery)
			searchParams.append("search", config.searchQuery);
		if (config.ordering) searchParams.append("ordering", config.ordering);

		// Add any additional parameters
		if (config.additionalParams) {
			Object.entries(config.additionalParams).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					searchParams.append(key, value.toString());
				}
			});
		}

		const url = `${config.exportEndpoint}${
			searchParams.toString() ? `?${searchParams.toString()}` : ""
		}`;

		logger.info(`Exporting ${config.entityName} as ${format.toUpperCase()}`, { url, config });

		try {
			const blob = await apiClient.getBlob(url);
			console.log(`Export successful:`, {
				blob,
				size: blob.size,
				type: blob.type,
			});
			return blob;
		} catch (error) {
			logger.error("Export failed", { error });
			throw error;
		}
	}

	/**
	 * Download exported data as a file
	 */
	static downloadBlob(blob: Blob, filename: string): void {
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	}

	/**
	 * Complete export workflow with user feedback
	 */
	static async exportAndDownload(
		format: "csv" | "json",
		config: ExportConfig,
		onStart?: () => void,
		onComplete?: () => void
	): Promise<void> {
		onStart?.();

		try {
			const blob = await this.exportData(format, config);
			const filename = generateFilename(
				`${config.entityName}_all`,
				format
			);

			this.downloadBlob(blob, filename);
			toast.success(
				`Exported all ${config.entityName} to ${format.toUpperCase()}`
			);
		} catch (error) {
			logger.error("Export failed", { error });
			toast.error("Export failed. Please try again.");
		} finally {
			onComplete?.();
		}
	}
}
