/**
 * Builds query parameters by filtering out undefined and null values.
 *
 * Use this to standardize parameter handling across services - it automatically
 * removes undefined/null/empty values and handles arrays properly.
 *
 * @example
 * const params = buildQueryParams({
 *   page: 1,
 *   search: 'test',
 *   filter: undefined, // excluded from result
 *   empty: '',         // excluded from result
 *   all: 'all',        // excluded from result (sentinel value)
 *   tags: ['a', 'b']   // included as array
 * });
 * // Returns: { page: 1, search: 'test', tags: ['a', 'b'] }
 */
export function buildQueryParams(
	params: Record<
		string,
		string | number | boolean | undefined | null | string[] | number[]
	>
): Record<string, string | number | boolean | string[] | number[]> {
	return Object.entries(params).reduce((acc, [key, value]) => {
		// Skip undefined and null
		if (value === undefined || value === null) {
			return acc;
		}

		// Skip empty strings, whitespace-only strings, and "all" sentinel value
		if (typeof value === "string") {
			const trimmed = value.trim();
			if (trimmed === "" || trimmed === "all") {
				return acc;
			}
			acc[key] = trimmed;
			return acc;
		}

		// Keep arrays if they have values
		if (Array.isArray(value)) {
			if (value.length > 0) {
				acc[key] = value;
			}
			return acc;
		}

		// Include everything else (numbers, booleans)
		acc[key] = value;
		return acc;
	}, {} as Record<string, string | number | boolean | string[] | number[]>);
}
