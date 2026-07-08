/**
 * Collapse sequential certificate numbers into ranges.
 *
 * Input: ["R000001", "R000002", "R000003", "R000005", "R000010"]
 * Output: ["R000001-R000003", "R000005", "R000010"]
 *
 * Works with the R{digits} format. Non-matching formats are passed through as-is.
 */
export const collapseCertRanges = (numbers: string[]): string[] => {
	if (numbers.length <= 1) return numbers;

	// Parse R-prefixed numbers into { original, num } pairs
	const parsed = numbers
		.map((n) => {
			const match = n.match(/^R(\d+)$/);
			return match
				? { original: n, num: parseInt(match[1], 10) }
				: { original: n, num: null };
		})
		.sort((a, b) => {
			if (a.num === null && b.num === null) return 0;
			if (a.num === null) return 1;
			if (b.num === null) return -1;
			return a.num - b.num;
		});

	const result: string[] = [];
	let rangeStart: { original: string; num: number } | null = null;
	let rangeEnd: { original: string; num: number } | null = null;

	for (const item of parsed) {
		if (item.num === null) {
			// Non-R-format — flush any open range and add as-is
			if (rangeStart && rangeEnd) {
				result.push(formatRange(rangeStart, rangeEnd));
			}
			rangeStart = null;
			rangeEnd = null;
			result.push(item.original);
			continue;
		}

		if (rangeStart === null) {
			rangeStart = item;
			rangeEnd = item;
		} else if (rangeEnd && item.num === rangeEnd.num + 1) {
			rangeEnd = item;
		} else {
			// Gap — flush the range
			result.push(formatRange(rangeStart, rangeEnd!));
			rangeStart = item;
			rangeEnd = item;
		}
	}

	// Flush final range
	if (rangeStart && rangeEnd) {
		result.push(formatRange(rangeStart, rangeEnd));
	}

	return result;
};

const formatRange = (
	start: { original: string; num: number },
	end: { original: string; num: number }
): string => {
	if (start.num === end.num) return start.original;
	return `${start.original}-${end.original}`;
};
