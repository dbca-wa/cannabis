/**
 * Certificate Formatting Utilities
 *
 * Shared utilities for formatting data in the certificate preview panel and
 * related components. Matches the backend Aptos template formatting logic.
 */

/* Minimal Temporal type declaration for environments without ES2027 lib */
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Temporal {
		interface PlainDate {
			toLocaleString(
				locale: string,
				options?: Intl.DateTimeFormatOptions
			): string;
		}
		const PlainDate: {
			from(item: string): PlainDate;
		};
	}
}

export interface OfficerDetails {
	rank_display?: string | null;
	badge_number?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	station_name?: string | null;
}

/**
 * Format an ISO date string to "DD Month YYYY" (e.g., "11 June 2026")
 * using the Temporal API for reliable date parsing without timezone issues.
 * Returns "[Pending]" if the input is falsy.
 */
export const formatCertificateDate = (
	isoDate: string | null | undefined
): string => {
	if (!isoDate) return "[Pending]";
	const date = Temporal.PlainDate.from(isoDate.split("T")[0]);
	return date.toLocaleString("en-AU", {
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
	const firstName = officer.first_name || "";
	const org = officer.station_name || "";

	let result = rank;
	if (badge) result += ` ${badge}`;
	if (surname) result += ` ${surname}`;
	if (firstName) result += `, ${firstName}`;
	if (org) result += ` of ${org}`;

	return result.trim() || "[Pending]";
};

/**
 * Build the content description string from an array of bags.
 * Deduplicates content types, filters out falsy values.
 * Returns "quantity of Plant Material, Seed" or "quantity of [Pending]" if empty.
 */
export const formatContentDescription = (
	bags: Array<{ content_type_display?: string }>
): string => {
	const types = [
		...new Set(bags.map((b) => b.content_type_display).filter(Boolean)),
	];
	if (types.length === 0) return "quantity of [Pending]";
	return `quantity of ${types.join(", ")}`;
};
