/**
 * Format a number as Australian currency (AUD)
 */
export const formatCurrency = (amount: string | number): string => {
	const num = typeof amount === "string" ? parseFloat(amount) : amount;
	if (isNaN(num)) return "$0.00";
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
	}).format(num);
};

/**
 * Format bytes to human-readable file size
 */
export const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
