/**
 * Data export utilities for tables and reports
 * Supports CSV and JSON export formats
 */

export interface ExportColumn<T> {
	key: keyof T | string;
	label: string;
	getValue?: (item: T) => string | number | boolean | null | undefined;
	format?: (value: any) => string;
}

export interface ExportOptions {
	filename?: string;
	includeHeaders?: boolean;
	dateFormat?: string;
}

/**
 * Convert data to CSV format
 */
export function convertToCSV<T>(
	data: T[],
	columns: ExportColumn<T>[],
	options: ExportOptions = {}
): string {
	const { includeHeaders = true } = options;
	const rows: string[] = [];

	// Add headers if requested
	if (includeHeaders) {
		const headers = columns.map((col) => `"${col.label}"`);
		rows.push(headers.join(","));
	}

	// Add data rows
	data.forEach((item) => {
		const values = columns.map((col) => {
			let value: any;

			if (col.getValue) {
				value = col.getValue(item);
			} else {
				value = (item as any)[col.key];
			}

			// Format the value if formatter provided
			if (col.format && value !== null && value !== undefined) {
				value = col.format(value);
			}

			// Handle null/undefined values
			if (value === null || value === undefined) {
				return '""';
			}

			// Convert to string and escape quotes
			const stringValue = String(value).replace(/"/g, '""');
			return `"${stringValue}"`;
		});

		rows.push(values.join(","));
	});

	return rows.join("\n");
}

/**
 * Convert data to JSON format
 */
export function convertToJSON<T>(
	data: T[],
	columns: ExportColumn<T>[],
	_options: ExportOptions = {}
): string {
	const exportData = data.map((item) => {
		const exportItem: Record<string, any> = {};

		columns.forEach((col) => {
			let value: any;

			if (col.getValue) {
				value = col.getValue(item);
			} else {
				value = (item as any)[col.key];
			}

			// Format the value if formatter provided
			if (col.format && value !== null && value !== undefined) {
				value = col.format(value);
			}

			exportItem[col.label] = value;
		});

		return exportItem;
	});

	return JSON.stringify(exportData, null, 2);
}

/**
 * Download data as a file
 */
export function downloadFile(
	content: string,
	filename: string,
	mimeType: string = "text/plain"
): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.style.display = "none";

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up the URL object
	URL.revokeObjectURL(url);
}

/**
 * Export data as CSV file
 */
export function exportToCSV<T>(
	data: T[],
	columns: ExportColumn<T>[],
	options: ExportOptions = {}
): void {
	const { filename = "export.csv" } = options;
	const csvContent = convertToCSV(data, columns, options);
	downloadFile(csvContent, filename, "text/csv");
}

/**
 * Export data as JSON file
 */
export function exportToJSON<T>(
	data: T[],
	columns: ExportColumn<T>[],
	options: ExportOptions = {}
): void {
	const { filename = "export.json" } = options;
	const jsonContent = convertToJSON(data, columns, options);
	downloadFile(jsonContent, filename, "application/json");
}

/**
 * Format date for export
 */
export function formatDateForExport(
	date: string | Date | null | undefined,
	format: string = "YYYY-MM-DD"
): string {
	if (!date) return "";

	const dateObj = typeof date === "string" ? new Date(date) : date;

	if (isNaN(dateObj.getTime())) return "";

	switch (format) {
		case "YYYY-MM-DD":
			return dateObj.toISOString().split("T")[0];
		case "MM/DD/YYYY":
			return dateObj.toLocaleDateString("en-US");
		case "DD/MM/YYYY":
			return dateObj.toLocaleDateString("en-GB");
		case "ISO":
			return dateObj.toISOString();
		default:
			return dateObj.toLocaleDateString();
	}
}

/**
 * Format boolean for export
 */
export function formatBooleanForExport(
	value: boolean | null | undefined
): string {
	if (value === null || value === undefined) return "";
	return value ? "Yes" : "No";
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(
	prefix: string,
	extension: string = "csv"
): string {
	const timestamp = new Date()
		.toISOString()
		.replace(/[:.]/g, "-")
		.split("T")[0];
	return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Common export columns for different entity types
 */
export const commonExportColumns = {
	user: [
		{ key: "id", label: "ID" },
		{ key: "full_name", label: "Full Name" },
		{ key: "email", label: "Email" },
		{ key: "role", label: "Role" },
		{
			key: "is_active",
			label: "Active",
			format: formatBooleanForExport,
		},
		{
			key: "is_staff",
			label: "Staff",
			format: formatBooleanForExport,
		},
		{
			key: "date_joined",
			label: "Date Joined",
			format: (date: string) => formatDateForExport(date),
		},
	] as ExportColumn<any>[],

	policeOfficer: [
		{ key: "id", label: "ID" },
		{ key: "badge_number", label: "Badge Number" },
		{ key: "full_name", label: "Full Name" },
		{ key: "rank_display", label: "Rank" },
		{ key: "station_name", label: "Station" },
		{
			key: "is_sworn",
			label: "Sworn",
			format: formatBooleanForExport,
		},
	] as ExportColumn<any>[],

	policeStation: [
		{ key: "id", label: "ID" },
		{ key: "name", label: "Station Name" },
		{ key: "address", label: "Address" },
		{ key: "phone", label: "Phone" },
		{ key: "officer_count", label: "Officer Count" },
	] as ExportColumn<any>[],

	defendant: [
		{ key: "id", label: "ID" },
		{ key: "first_name", label: "First Name" },
		{ key: "last_name", label: "Last Name" },
		{ key: "full_name", label: "Full Name" },
		{ key: "cases_count", label: "Cases Count" },
	] as ExportColumn<any>[],

	submission: [
		{ key: "id", label: "ID" },
		{ key: "case_number", label: "Case Number" },
		{ key: "phase_display", label: "Phase" },
		{
			key: "received",
			label: "Received Date",
			format: (date: string) => formatDateForExport(date),
		},
		{ key: "requesting_officer_name", label: "Requesting Officer" },
		{ key: "approved_botanist_name", label: "Botanist" },
		{ key: "finance_officer_name", label: "Finance Officer" },
		{ key: "bags_count", label: "Bags Count" },
		{ key: "defendants_count", label: "Defendants Count" },
		{
			key: "cannabis_present",
			label: "Cannabis Present",
			format: formatBooleanForExport,
		},
	] as ExportColumn<any>[],

	certificate: [
		{ key: "id", label: "ID" },
		{ key: "certificate_number", label: "Certificate Number" },
		{
			key: "pdf_generating",
			label: "PDF Generating",
			format: formatBooleanForExport,
		},
		{ key: "pdf_size", label: "PDF Size (bytes)" },
		{
			key: "created_at",
			label: "Created Date",
			format: (date: string) => formatDateForExport(date),
		},
	] as ExportColumn<any>[],

	invoice: [
		{ key: "id", label: "ID" },
		{ key: "invoice_number", label: "Invoice Number" },
		{ key: "customer_number", label: "Customer Number" },
		{ key: "subtotal", label: "Subtotal" },
		{ key: "tax_amount", label: "Tax Amount" },
		{ key: "total", label: "Total" },
		{
			key: "pdf_generating",
			label: "PDF Generating",
			format: formatBooleanForExport,
		},
		{ key: "pdf_size", label: "PDF Size (bytes)" },
		{
			key: "created_at",
			label: "Created Date",
			format: (date: string) => formatDateForExport(date),
		},
	] as ExportColumn<any>[],
};
