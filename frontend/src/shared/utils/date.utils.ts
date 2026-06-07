/**
 * Date Formatting Utilities
 *
 * Utilities for formatting dates and times consistently across the application.
 * Uses Australian date format (DD/MM/YYYY) throughout.
 */

/**
 * Format a date string to Australian date format (DD/MM/YYYY)
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string (DD/MM/YYYY)
 */
export function formatDate(
	dateString: string | Date | null | undefined
): string {
	if (!dateString) return "";

	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;

	if (isNaN(date.getTime())) return "";

	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();

	return `${day}/${month}/${year}`;
}

/**
 * Format a date string to Australian date and time format (DD/MM/YYYY HH:MM)
 *
 * @param dateString - ISO date string or Date object
 * @returns Formatted date and time string (DD/MM/YYYY HH:MM)
 */
export function formatDateTime(
	dateString: string | Date | null | undefined
): string {
	if (!dateString) return "";

	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;

	if (isNaN(date.getTime())) return "";

	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format a date string to relative time (e.g., "2 days ago", "in 3 hours")
 *
 * @param dateString - ISO date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(
	dateString: string | Date | null | undefined
): string {
	if (!dateString) return "";

	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;

	if (isNaN(date.getTime())) return "";

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return "just now";
	if (diffMins < 60)
		return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
	if (diffHours < 24)
		return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
	if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
	}
	if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return `${months} month${months !== 1 ? "s" : ""} ago`;
	}

	const years = Math.floor(diffDays / 365);
	return `${years} year${years !== 1 ? "s" : ""} ago`;
}
