/**
 * Certificate Formatting Utilities
 *
 * Shared utilities for formatting data in the certificate preview panel and
 * related components. Matches the backend Aptos template formatting logic.
 */

export interface OfficerDetails {
	rank_display?: string | null;
	badge_number?: string | null;
	given_names?: string | null;
	last_name?: string | null;
	station_name?: string | null;
}

/**
 * Format an ISO date string to "DD Month YYYY" (e.g., "11 June 2026").
 * Parses date parts manually to avoid timezone-related off-by-one errors
 * that occur with `new Date("YYYY-MM-DD")` (interpreted as UTC midnight).
 * Returns "[Pending]" if the input is falsy.
 */
export const formatCertificateDate = (
	isoDate: string | null | undefined
): string => {
	if (!isoDate) return "[Pending]";
	const [year, month, day] = isoDate.split("T")[0].split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
};

const ONES = [
	"",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
	"eleven",
	"twelve",
	"thirteen",
	"fourteen",
	"fifteen",
	"sixteen",
	"seventeen",
	"eighteen",
	"nineteen",
];

const TENS = [
	"",
	"",
	"twenty",
	"thirty",
	"forty",
	"fifty",
	"sixty",
	"seventy",
	"eighty",
	"ninety",
];

/**
 * Convert an integer (0–99) to English words. Returns numeric string for 100+.
 * n === 0 returns "" (empty string) to match backend _number_to_words logic.
 */
export const numberToWords = (n: number): string => {
	if (n < 0) return String(n);
	if (n < 20) return ONES[n];
	if (n < 100) {
		const tens = TENS[Math.floor(n / 10)];
		const ones = ONES[n % 10];
		return ones ? `${tens}-${ones}` : tens;
	}
	return String(n);
};

/**
 * Format officer details in legal certificate format:
 * "Rank BadgeNumber SURNAME, FirstName of Organisation"
 *
 * Returns "[Pending]" for null/undefined officer or when all fields are empty.
 */
export const formatOfficerLegal = (
	officer: OfficerDetails | null | undefined
): string => {
	if (!officer) return "[Pending]";

	const rank = officer.rank_display || "";
	const badge = officer.badge_number || "";
	const surname = (officer.last_name || "").toUpperCase();
	const firstName = officer.given_names || "";
	const org = officer.station_name || "";

	let result = "";
	if (rank && !["unknown", "other"].includes(rank.toLowerCase())) {
		result = rank;
	}
	if (badge) result += result ? ` ${badge}` : badge;
	if (surname) result += ` ${surname}`;
	if (firstName) result += `, ${firstName}`;
	if (org) result += ` of ${org}`;

	return result.trim() || "[Pending]";
};

/**
 * Join values as a readable English list.
 *
 * Certificates are read aloud in court, so lists of tag numbers and content
 * types need to read as prose rather than as comma-separated data.
 *
 *     []              -> ""
 *     ["A"]           -> "A"
 *     ["A", "B"]      -> "A and B"
 *     ["A", "B", "C"] -> "A, B and C"
 *
 * Empty and whitespace-only values are dropped. No serial comma before "and",
 * matching Australian usage. Mirrors the backend join_with_and helper.
 */
export const joinWithAnd = (
	values: Array<string | null | undefined>
): string => {
	const items = values
		.map((value) => value?.trim())
		.filter((value): value is string => !!value);

	if (items.length === 0) return "";
	if (items.length === 1) return items[0];
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

/**
 * Build the content description string from an array of bags.
 * Deduplicates content types, filters out falsy values.
 * Returns "quantity of Plant Material and Seed" or "quantity of [Pending]".
 */
export const formatContentDescription = (
	bags: Array<{ content_type_display?: string }>
): string => {
	const types = [...new Set(bags.map((b) => b.content_type_display))];
	const joined = joinWithAnd(types);
	return `quantity of ${joined || "[Pending]"}`;
};
